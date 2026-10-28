from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlparse

from calculations import (
    convert_area,
    convert_length,
    normalize_area_unit,
    normalize_length_unit,
)

SUPPORTED_CHECKS = {
    "fsi_far": ("fsi_far", "ratio"),
    "plot_coverage": ("plot_coverage_percent", "%"),
    "front_setback": ("front_setback", "length"),
    "side_setback": ("side_setback", "length"),
    "rear_setback": ("rear_setback", "length"),
    "setback": ("setback", "length"),
    "building_height": ("building_height", "length"),
    "road_width": ("road_width", "length"),
    "parking": ("parking", "spaces"),
}
REQUIRED_CONTEXT_FIELDS = (
    "jurisdiction",
    "local_body",
    "building_use",
    "plot_classification",
    "rule_version",
)
REQUIRED_RULE_PROVENANCE_FIELDS = (
    "source_document_title",
    "government_order_or_gazette_identifier",
    "rule_or_table_reference",
    "publication_or_amendment_date",
    "official_source_url",
    "verification_status",
    "applicability_notes",
)
VERIFICATION_STATUSES = {"VERIFIED", "UNVERIFIED"}
OFFICER_CONFIRMATION_STATUS = "OFFICER_CONFIRMED"


class RuleConfigurationError(ValueError):
    """Raised when an external rule configuration is missing or malformed."""


def load_rule_config(path: str | None) -> dict[str, Any]:
    if not path:
        return {"context": {}, "rules": {}}
    config_path = Path(path)
    try:
        with config_path.open("r", encoding="utf-8") as config_file:
            config = json.load(config_file)
    except (OSError, json.JSONDecodeError) as exc:
        raise RuleConfigurationError(
            "The configured rule file could not be read as valid JSON."
        ) from exc
    if not isinstance(config, dict):
        raise RuleConfigurationError("The rule configuration root must be an object.")

    context = config.get("context", {})
    rules = config.get("rules", {})
    if not isinstance(context, dict) or not isinstance(rules, dict):
        raise RuleConfigurationError("'context' and 'rules' must be JSON objects.")
    context_verification_status = context.get("verification_status")
    if context_verification_status not in VERIFICATION_STATUSES:
        raise RuleConfigurationError(
            "Context verification_status must be 'VERIFIED' or 'UNVERIFIED'."
        )
    unknown_checks = set(rules) - set(SUPPORTED_CHECKS)
    if unknown_checks:
        raise RuleConfigurationError(
            f"Unsupported configured check names: {', '.join(sorted(unknown_checks))}."
        )
    for name, rule in rules.items():
        if not isinstance(rule, dict):
            raise RuleConfigurationError(f"Rule '{name}' must be a JSON object.")
        verification_status = rule.get("verification_status")
        if verification_status not in VERIFICATION_STATUSES:
            raise RuleConfigurationError(
                f"Rule '{name}' must specify verification_status as "
                "'VERIFIED' or 'UNVERIFIED'."
            )

        provenance = rule.get("provenance")
        if not isinstance(provenance, dict):
            raise RuleConfigurationError(
                f"Rule '{name}' must include a provenance object."
            )
        missing_provenance = [
            field for field in REQUIRED_RULE_PROVENANCE_FIELDS if field not in provenance
        ]
        if missing_provenance:
            raise RuleConfigurationError(
                f"Rule '{name}' is missing provenance fields: "
                f"{', '.join(missing_provenance)}."
            )
        if not isinstance(provenance["applicability_notes"], str) or not (
            provenance["applicability_notes"].strip()
        ):
            raise RuleConfigurationError(
                f"Rule '{name}' must include applicability notes."
            )
        if provenance["verification_status"] != verification_status:
            raise RuleConfigurationError(
                f"Rule '{name}' provenance verification status must match the rule."
            )
        for field in REQUIRED_RULE_PROVENANCE_FIELDS:
            provenance_value = provenance[field]
            if field == "applicability_notes":
                continue
            if provenance_value is not None and not isinstance(provenance_value, str):
                raise RuleConfigurationError(
                    f"Rule '{name}' provenance field '{field}' must be a string or null."
                )
        if verification_status == "VERIFIED":
            for field in ("source_document_title", "rule_or_table_reference"):
                if not provenance[field] or not provenance[field].strip():
                    raise RuleConfigurationError(
                        f"Verified rule '{name}' must include provenance field "
                        f"'{field}'."
                    )
            source_url = urlparse(provenance["official_source_url"] or "")
            if source_url.scheme != "https" or not source_url.netloc:
                raise RuleConfigurationError(
                    f"Verified rule '{name}' must include an HTTPS official source URL."
                )
        publication_date = provenance["publication_or_amendment_date"]
        if publication_date is not None:
            if not isinstance(publication_date, str):
                raise RuleConfigurationError(
                    f"Rule '{name}' publication_or_amendment_date must be a date string or null."
                )
            try:
                datetime.fromisoformat(publication_date)
            except ValueError as exc:
                raise RuleConfigurationError(
                    f"Rule '{name}' publication_or_amendment_date must be ISO-8601."
                ) from exc

        value = rule.get("value")
        if verification_status == "VERIFIED":
            if rule.get("operator") not in {"min", "max"}:
                raise RuleConfigurationError(
                    f"Verified rule '{name}' must specify operator 'min' or 'max'."
                )
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise RuleConfigurationError(
                    f"Verified rule '{name}' must have a numeric value."
                )
            if not math.isfinite(float(value)) or float(value) < 0:
                raise RuleConfigurationError(
                    f"Verified rule '{name}' must have a finite non-negative value."
                )
        elif value is not None or rule.get("operator") is not None:
            raise RuleConfigurationError(
                f"Unverified rule '{name}' must not include a value or operator."
            )
        if not isinstance(rule.get("unit"), str) or not rule["unit"].strip():
            raise RuleConfigurationError(f"Rule '{name}' must specify a unit.")
        if not isinstance(rule.get("source"), str) or not rule["source"].strip():
            raise RuleConfigurationError(
                f"Rule '{name}' must describe its source or verification status."
            )
    return {"context": context, "rules": rules}


def validate_officer_confirmed_measurements(
    measurements: Mapping[str, Any],
) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """Validate officer attestations separately from OCR candidate measurements."""
    accepted: dict[str, dict[str, Any]] = {}
    errors: dict[str, str] = {}
    supported_measurement_keys = {
        measurement_key: default_unit
        for measurement_key, default_unit in SUPPORTED_CHECKS.values()
    }

    if not isinstance(measurements, Mapping):
        return {}, {"measurements": "Officer-confirmed measurements must be an object."}

    for key, measurement in measurements.items():
        if not isinstance(key, str) or key not in supported_measurement_keys:
            errors[str(key)] = "The measurement key is not a supported compliance check."
            continue
        if not isinstance(measurement, Mapping):
            errors[key] = "The officer-confirmed measurement must be an object."
            continue

        required_fields = (
            "value",
            "unit",
            "confirmed_by",
            "confirmed_at",
            "verification_status",
        )
        missing_fields = [
            field
            for field in required_fields
            if field not in measurement or measurement[field] is None
        ]
        if missing_fields:
            errors[key] = (
                "Missing required officer-confirmation fields: "
                + ", ".join(missing_fields)
                + "."
            )
            continue

        value = measurement["value"]
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or float(value) < 0
        ):
            errors[key] = "The confirmed measurement value must be finite and non-negative."
            continue

        unit = measurement["unit"]
        expected_unit = supported_measurement_keys[key]
        if not isinstance(unit, str) or not unit.strip():
            errors[key] = "The confirmed measurement unit must be a non-empty string."
            continue
        if expected_unit == "length":
            compatible_unit = normalize_length_unit(unit) is not None
        elif expected_unit == "%":
            compatible_unit = unit.strip().lower() in {"%", "percent", "percentage"}
        elif expected_unit == "spaces":
            compatible_unit = unit.strip().lower() in {"space", "spaces"}
        else:
            compatible_unit = unit.strip().lower() == expected_unit
        if not compatible_unit:
            errors[key] = (
                f"The confirmed measurement unit is incompatible; expected {expected_unit}."
            )
            continue

        confirmed_by = measurement["confirmed_by"]
        if not isinstance(confirmed_by, str) or not confirmed_by.strip():
            errors[key] = "confirmed_by must identify the confirming officer."
            continue
        confirmed_at = measurement["confirmed_at"]
        if not isinstance(confirmed_at, str) or not confirmed_at.strip():
            errors[key] = "confirmed_at must be a valid ISO-8601 timestamp."
            continue
        try:
            datetime.fromisoformat(confirmed_at.replace("Z", "+00:00"))
        except ValueError:
            errors[key] = "confirmed_at must be a valid ISO-8601 timestamp."
            continue
        if measurement["verification_status"] != OFFICER_CONFIRMATION_STATUS:
            errors[key] = (
                "verification_status must be 'OFFICER_CONFIRMED'; OCR confidence "
                "does not establish officer confirmation."
            )
            continue

        accepted[key] = {
            "value": float(value),
            "unit": (
                "%"
                if expected_unit == "%"
                else "spaces"
                if expected_unit == "spaces"
                else unit.strip()
            ),
            "confirmed_by": confirmed_by.strip(),
            "confirmed_at": confirmed_at,
            "verification_status": OFFICER_CONFIRMATION_STATUS,
        }
    return accepted, errors


def evaluate_officer_confirmed_compliance(
    measurements: Mapping[str, Any],
    rules: Mapping[str, Any],
    context: Mapping[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Evaluate only validated officer-confirmed measurements; return input errors."""
    accepted_measurements, errors = validate_officer_confirmed_measurements(
        measurements
    )
    results = evaluate_compliance(
        measurements=accepted_measurements,
        rules=rules,
        context=context,
    )
    return results, errors


def _value_and_unit(
    measurement: Any,
) -> tuple[float, str, str | None, str | None]:
    if isinstance(measurement, Mapping):
        value = measurement.get("value")
        unit = measurement.get("unit")
        uncertainty = measurement.get("uncertainty")
        review_reason = None
        if measurement.get("requires_manual_review"):
            review_reason = "The measurement is flagged for manual verification."
        elif measurement.get("is_estimate"):
            review_reason = "The measurement is an estimate and needs manual verification."
    else:
        raise ValueError("The measurement must include a value and unit.")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("The measured value is missing or not numeric.")
    numeric_value = float(value)
    if not math.isfinite(numeric_value) or numeric_value < 0:
        raise ValueError("The measured value is invalid.")
    if not isinstance(unit, str) or not unit.strip():
        raise ValueError("The measured unit is missing.")
    return (
        numeric_value,
        unit,
        str(uncertainty) if uncertainty else None,
        review_reason,
    )


def _convert_for_rule(
    measured_value: float, measured_unit: str, required_unit: str
) -> float:
    normalized_measured_length = normalize_length_unit(measured_unit)
    normalized_required_length = normalize_length_unit(required_unit)
    if normalized_measured_length is not None and normalized_required_length is not None:
        return convert_length(measured_value, measured_unit, required_unit)

    normalized_measured_area = normalize_area_unit(measured_unit)
    normalized_required_area = normalize_area_unit(required_unit)
    if normalized_measured_area is not None and normalized_required_area is not None:
        return convert_area(measured_value, measured_unit, required_unit)

    if measured_unit.strip().lower() != required_unit.strip().lower():
        raise ValueError("Measured and required units are incompatible.")
    return measured_value


def evaluate_compliance(
    measurements: Mapping[str, Any],
    rules: Mapping[str, Any],
    context: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """Evaluate configured preliminary checks without embedding regulatory limits."""
    missing_context = [
        field
        for field in REQUIRED_CONTEXT_FIELDS
        if not isinstance(context.get(field), str) or not context[field].strip()
    ]
    results: list[dict[str, Any]] = []

    for check_name, (measurement_key, default_unit) in SUPPORTED_CHECKS.items():
        rule = rules.get(check_name)
        result: dict[str, Any] = {
            "check": check_name,
            "status": "NEEDS_REVIEW",
            "measured_value": None,
            "measured_unit": None,
            "required_value": None,
            "required_unit": None,
            "reason": "",
            "rule_source": None,
            "uncertainty": None,
        }
        if isinstance(rule, Mapping):
            result["required_value"] = rule.get("value")
            result["required_unit"] = rule.get("unit", default_unit)
            result["rule_source"] = rule.get("source")
            result["uncertainty"] = rule.get("uncertainty")

        measurement_error: str | None = None
        measurement_review_reason: str | None = None
        measured_value: float | None = None
        measured_unit: str | None = None
        measurement_uncertainty: str | None = None
        try:
            (
                measured_value,
                measured_unit,
                measurement_uncertainty,
                measurement_review_reason,
            ) = _value_and_unit(measurements.get(measurement_key))
        except (KeyError, TypeError, ValueError) as exc:
            measurement_error = str(exc) or "Required measurement is unavailable."

        result["measured_value"] = measured_value
        result["measured_unit"] = measured_unit
        result["uncertainty"] = measurement_uncertainty or result["uncertainty"]
        if not isinstance(rule, Mapping):
            result["reason"] = "No verified applicable rule is configured for this check."
            results.append(result)
            continue
        if rule.get("verification_status", "VERIFIED") != "VERIFIED":
            result["reason"] = "The configured rule is unverified and cannot be evaluated."
            results.append(result)
            continue
        if context.get("verification_status", "VERIFIED") != "VERIFIED":
            result["reason"] = "The jurisdiction context is unverified and needs review."
            results.append(result)
            continue
        if missing_context:
            result["reason"] = (
                "Applicable jurisdiction details are incomplete: "
                + ", ".join(missing_context)
                + "."
            )
            results.append(result)
            continue

        if measurement_error:
            result["reason"] = measurement_error
            results.append(result)
            continue
        if measurement_review_reason:
            result["reason"] = measurement_review_reason
            results.append(result)
            continue
        if measured_value is None or measured_unit is None:
            result["reason"] = "Required measurement is unavailable."
            results.append(result)
            continue

        try:
            if measurement_key == "plot_coverage_percent" and measured_unit in {
                "percent",
                "percentage",
            }:
                measured_unit = "%"
                result["measured_unit"] = measured_unit
            required_value = float(rule["value"])
            required_unit = str(rule["unit"])
            comparable_value = _convert_for_rule(
                measured_value, measured_unit, required_unit
            )
        except (KeyError, TypeError, ValueError) as exc:
            result["reason"] = str(exc) or "Measurement and rule could not be compared."
            results.append(result)
            continue
        operator = rule.get("operator")
        if operator not in {"min", "max"}:
            result["reason"] = "The configured rule operator is invalid."
            results.append(result)
            continue

        passed = (
            comparable_value >= required_value
            if operator == "min"
            else comparable_value <= required_value
        )
        result["status"] = "PASS" if passed else "FAIL"
        relation = "at least" if operator == "min" else "at most"
        result["reason"] = (
            f"Measured value {comparable_value:g} {required_unit} is "
            f"{'within' if passed else 'outside'} the configured limit "
            f"({relation} {required_value:g} {required_unit})."
        )
        results.append(result)

    return results