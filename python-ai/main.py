from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from calculations import calculate_fsi
from ocr_service import OCRProcessingError, OCRSetupError, process_document
from rule_engine import (
    RuleConfigurationError,
    evaluate_compliance,
    evaluate_officer_confirmed_compliance,
    load_rule_config,
)
from value_parse import (
    extract_candidate_measurements,
    extract_plan_metrics,
    extract_room_dimension_candidates,
)

logger = logging.getLogger(__name__)

SERVICE_NAME = "PlanSanction AI Plan Analysis Service"
MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(25 * 1024 * 1024)))
if MAX_UPLOAD_SIZE_BYTES <= 0:
    raise RuntimeError("MAX_UPLOAD_SIZE_BYTES must be a positive integer.")

DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")
configured_origins = os.getenv("CORS_ORIGINS")
CORS_ORIGINS = tuple(
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
) if configured_origins else DEFAULT_CORS_ORIGINS
if not CORS_ORIGINS or "*" in CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS must contain explicit frontend origins; '*' is not allowed.")

app = FastAPI(
    title=SERVICE_NAME,
    description="Preliminary OCR-assisted building-plan technical scrutiny.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
SIGNATURES = {
    ".pdf": lambda content: content.startswith(b"%PDF-"),
    ".png": lambda content: content.startswith(b"\x89PNG\r\n\x1a\n"),
    ".jpg": lambda content: content.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda content: content.startswith(b"\xff\xd8\xff"),
}
MIN_RELIABLE_OCR_CONFIDENCE = 80.0


def _display_filename(filename: str) -> str:
    return Path(filename.replace("\\", "/")).name


def _reliable_measurement(
    measurements: list[dict[str, object]], label: str
) -> dict[str, object] | None:
    matches = [
        measurement
        for measurement in measurements
        if measurement.get("label") == label
        and measurement.get("requires_manual_review") is False
        and isinstance(measurement.get("confidence"), (int, float))
        and float(measurement["confidence"]) >= MIN_RELIABLE_OCR_CONFIDENCE
        and isinstance(measurement.get("value"), (int, float))
        and isinstance(measurement.get("unit"), str)
    ]
    return matches[0] if len(matches) == 1 else None


def _calculate_metrics(
    measurements: list[dict[str, object]],
    warnings: list[str],
    pages: list[dict[str, object]] | None = None,
    room_candidates: list[dict[str, object]] | None = None,
) -> dict[str, dict[str, object]]:
    metrics: dict[str, dict[str, object]] = {}
    
    # 1. High-confidence reliable measurements if explicitly tagged
    plot_area = _reliable_measurement(measurements, "plot_area")
    total_floor_area = _reliable_measurement(measurements, "total_floor_area")

    if plot_area is not None and total_floor_area is not None:
        try:
            fsi = calculate_fsi(
                float(total_floor_area["value"]),
                str(total_floor_area["unit"]),
                float(plot_area["value"]),
                str(plot_area["unit"]),
            )
            metrics["fsi_far"] = {
                "value": fsi,
                "unit": "ratio",
                "is_estimate": True,
                "inputs": ["total_floor_area", "plot_area"],
                "uncertainty": "Calculated from explicitly labelled OCR text.",
            }
        except ValueError:
            pass

    # 2. Extract metrics from plan drawing text and room geometry
    plan_geo = extract_plan_metrics(pages or [], measurements, room_candidates or [])

    # Ground Coverage Area
    metrics["ground_coverage_area"] = {
        "value": plan_geo["ground_coverage_area"],
        "unit": "sq.m",
        "is_estimate": True,
        "uncertainty": "Calculated from plan drawing room/plinth dimensions.",
    }

    # Ground Coverage Percentage
    metrics["ground_coverage_percent"] = {
        "value": plan_geo["ground_coverage_percent"],
        "unit": "%",
        "is_estimate": True,
        "uncertainty": "Calculated as (Ground Coverage Area / Plot Area) * 100.",
    }
    metrics["plot_coverage"] = metrics["ground_coverage_percent"]

    # Total Built-Up Area
    metrics["built_up_area"] = {
        "value": plan_geo["built_up_area"],
        "unit": "sq.m",
        "is_estimate": True,
        "uncertainty": "Calculated as Ground Coverage Area * Floors.",
    }
    if "total_floor_area" not in metrics:
        metrics["total_floor_area"] = metrics["built_up_area"]

    # FAR (Floor Area Ratio)
    if "fsi_far" not in metrics:
        metrics["far"] = {
            "value": plan_geo["far"],
            "unit": "ratio",
            "is_estimate": True,
            "uncertainty": "Calculated as Total Built-Up Area / Plot Area.",
        }
        metrics["fsi_far"] = metrics["far"]
    else:
        metrics["far"] = metrics["fsi_far"]

    # Front Setback
    metrics["front_setback"] = {
        "value": plan_geo["front_setback"],
        "unit": "m",
        "is_estimate": True,
        "uncertainty": "Extracted from architectural plan setbacks or portico dimensions.",
    }

    # Road Width
    metrics["road_width"] = {
        "value": plan_geo["road_width"],
        "unit": "m",
        "is_estimate": True,
        "uncertainty": "Extracted from abutting street width.",
    }

    # Building Height
    metrics["building_height"] = {
        "value": plan_geo["building_height"],
        "unit": "m",
        "is_estimate": True,
        "uncertainty": "Calculated based on floor count and standard floor-to-floor height.",
    }

    # Plot Area
    if "plot_area" not in metrics:
        metrics["plot_area"] = {
            "value": plan_geo["plot_area"],
            "unit": "sq.m",
            "is_estimate": True,
            "uncertainty": "Extracted from plan plot declaration.",
        }

    return metrics


@app.get("/")
def root() -> dict[str, object]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


class EvaluateComplianceRequest(BaseModel):
    measurements: dict[str, object]
    rule_config_path: str | None = None


@app.post("/evaluate-compliance")
def evaluate_compliance_endpoint(
    request: EvaluateComplianceRequest,
) -> dict[str, object]:
    rule_config_path = request.rule_config_path or os.getenv("RULE_CONFIG_PATH")
    try:
        rule_config = load_rule_config(rule_config_path)
    except RuleConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    context = dict(rule_config.get("context", {}))
    rules = dict(rule_config.get("rules", {}))

    results, errors = evaluate_officer_confirmed_compliance(
        measurements=request.measurements,
        rules=rules,
        context=context,
    )
    return {
        "success": True,
        "results": results,
        "errors": errors,
        "evaluated_rules_count": len(results),
    }


@app.post("/analyze")
def analyze(
    file: Annotated[UploadFile, File(description="Building plan PDF, PNG, or JPEG")],
) -> dict[str, object]:
    temporary_path: str | None = None
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="An uploaded filename is required.")

        filename = _display_filename(file.filename)
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail="Unsupported file type. Upload a PDF, PNG, or JPEG plan.",
            )

        content = file.file.read(MAX_UPLOAD_SIZE_BYTES + 1)
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(content) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds the {MAX_UPLOAD_SIZE_BYTES}-byte upload limit.",
            )
        if not SIGNATURES[suffix](content):
            raise HTTPException(
                status_code=415,
                detail="The file contents do not match the supported file type.",
            )

        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=suffix, prefix="plansanction_", delete=False
        ) as temporary_file:
            temporary_file.write(content)
            temporary_path = temporary_file.name

        pages = process_document(temporary_path)
        if not pages:
            raise OCRProcessingError("No pages were returned for OCR.")

        extracted_text = [
            {"page_number": page["page_number"], "text": page["text"]}
            for page in pages
        ]
        candidate_measurements = extract_candidate_measurements(pages)

        room_dimension_candidates = extract_room_dimension_candidates(pages)
        
        warnings = [
            "This report is preliminary technical scrutiny only. It is not a "
            "municipal approval or a substitute for review by an authorized officer."
        ]
        if not any(page.get("text", "").strip() for page in pages):
            warnings.append(
                "No readable text was extracted. Check scan quality and verify the "
                "plan manually."
            )
        if any(
            measurement.get("requires_manual_review")
            or measurement.get("is_estimate")
            for measurement in candidate_measurements
        ):
            warnings.append(
                "OCR measurements are provisional candidates and must be verified "
                "against the plan before they are used for approval."
            )
        manual_review_items: list[dict[str, object]] = []
        for measurement in candidate_measurements:
            if not (
                measurement.get("requires_manual_review")
                or measurement.get("is_estimate")
            ):
                continue
            review_reasons = list(measurement["review_reasons"])
            if measurement.get("is_estimate"):
                review_reasons.append(
                    "OCR candidate values must be verified against the submitted plan."
                )
            manual_review_items.append(
                {
                    "type": "measurement",
                    "source_page": measurement["source_page"],
                    "source_text": measurement["source_text"],
                    "reasons": review_reasons,
                }
            )
        if not any(page.get("text", "").strip() for page in pages):
            manual_review_items.append(
                {
                    "type": "document",
                    "source_page": None,
                    "source_text": None,
                    "reasons": ["No readable OCR text was extracted from the document."],
                }
            )

        calculated_metrics = _calculate_metrics(
            candidate_measurements,
            warnings,
            pages=pages,
            room_candidates=room_dimension_candidates,
        )
        rule_config = load_rule_config(os.getenv("RULE_CONFIG_PATH"))
        context = dict(rule_config.get("context", {}))

        rule_measurements: dict[str, object] = dict(calculated_metrics)
        for label in (
            "plot_area",
            "front_setback",
            "side_setback",
            "rear_setback",
            "setback",
            "building_height",
            "road_width",
            "parking",
        ):
            candidate = _reliable_measurement(candidate_measurements, label)
            if candidate is not None:
                rule_measurements[label] = candidate

        compliance_checks = evaluate_compliance(
            measurements=rule_measurements,
            rules=rule_config.get("rules", {}),
            context=context,
        )
        if any(check["status"] == "NEEDS_REVIEW" for check in compliance_checks):
            warnings.append(
                "At least one compliance check needs review because required "
                "measurements, verified rules, or jurisdiction details are missing."
            )
        manual_review_items.extend(
            {
                "type": "compliance_check",
                "check": check["check"],
                "reasons": [check["reason"]],
            }
            for check in compliance_checks
            if check["status"] != "PASS"
        )

        manual_review_required = (
            bool(manual_review_items)
        )
        return {
            "success": True,
            "filename": filename,
            "page_count": len(pages),
            "extracted_text": extracted_text,
            "candidate_measurements": candidate_measurements,
            "calculated_metrics": calculated_metrics,
            "compliance_checks": compliance_checks,
            "warnings": warnings,
            "manual_review_items": manual_review_items,
            "manual_review_required": manual_review_required,
            "room_dimension_candidates": room_dimension_candidates,
        }
    except HTTPException:
        raise
    except OCRSetupError as exc:
        logger.warning("OCR setup is unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from None
    except OCRProcessingError:
        logger.exception("Could not process an uploaded building plan.")
        raise HTTPException(
            status_code=422,
            detail="The uploaded plan could not be processed. Check the file and try again.",
        ) from None
    except RuleConfigurationError:
        logger.exception("The configured preliminary rule set could not be loaded.")
        raise HTTPException(
            status_code=503,
            detail="The configured rule set is unavailable or invalid.",
        ) from None
    except Exception:
        logger.exception("Unexpected error while analyzing an uploaded building plan.")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred while analyzing the plan.",
        ) from None
    finally:
        if temporary_path is not None:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass
            except OSError:
                logger.exception("Could not remove a temporary uploaded plan.")
        file.file.close()
