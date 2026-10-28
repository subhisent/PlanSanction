from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError, PDFSyntaxError
from pytesseract import Output
from pytesseract import TesseractNotFoundError


class OCRSetupError(RuntimeError):
    """Raised when an external OCR or PDF-rendering executable is unavailable."""


class OCRProcessingError(RuntimeError):
    """Raised when a supported document cannot be decoded or OCR'd."""


SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
OCR_DPI = 300


def _ensure_tesseract() -> None:
    configured_path = os.getenv("TESSERACT_CMD")
    if configured_path:
        pytesseract.pytesseract.tesseract_cmd = configured_path
    try:
        pytesseract.get_tesseract_version()
    except TesseractNotFoundError as exc:
        raise OCRSetupError(
            "Tesseract OCR was not found. Install Tesseract and add it to PATH, "
            "or set TESSERACT_CMD to the executable path."
        ) from exc


def _preprocess(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        grayscale = image
    elif image.ndim == 3 and image.shape[2] == 4:
        grayscale = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    elif image.ndim == 3:
        grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        raise OCRProcessingError("The decoded image has an unsupported shape.")

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(grayscale)


def _ocr_page(image: np.ndarray, page_number: int) -> dict[str, Any]:
    prepared = _preprocess(image)
    language = os.getenv("TESSERACT_LANG", "eng")
    try:
        raw_words = pytesseract.image_to_data(
            prepared,
            lang=language,
            config="--psm 11",
            output_type=Output.DICT,
        )
        text = pytesseract.image_to_string(
            prepared,
            lang=language,
            config="--psm 11",
        )
    except TesseractNotFoundError as exc:
        raise OCRSetupError(
            "Tesseract OCR was not found. Install Tesseract and add it to PATH, "
            "or set TESSERACT_CMD to the executable path."
        ) from exc
    except pytesseract.TesseractError as exc:
        raise OCRProcessingError(
            "Tesseract could not recognize text on a document page."
        ) from exc

    words: list[dict[str, Any]] = []
    for index, raw_text in enumerate(raw_words.get("text", [])):
        word = str(raw_text).strip()
        if not word:
            continue
        try:
            confidence_value = float(raw_words["conf"][index])
        except (KeyError, IndexError, TypeError, ValueError):
            confidence_value = -1.0
        confidence = confidence_value if confidence_value >= 0 else None
        words.append(
            {
                "text": word,
                "confidence": confidence,
                "bbox": {
                    "x": int(raw_words["left"][index]),
                    "y": int(raw_words["top"][index]),
                    "width": int(raw_words["width"][index]),
                    "height": int(raw_words["height"][index]),
                },
                "block_num": int(raw_words["block_num"][index]),
                "par_num": int(raw_words["par_num"][index]),
                "line_num": int(raw_words["line_num"][index]),
            }
        )

    return {
        "page_number": page_number,
        "text": text.strip(),
        "words": words,
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
    }


def process_document(file_path: str | Path) -> list[dict[str, Any]]:
    """OCR a PDF or image and return per-page text and word-level metadata."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise OCRProcessingError("Only PDF, PNG, and JPEG documents are supported.")
    _ensure_tesseract()

    images: list[np.ndarray] = []
    if suffix == ".pdf":
        try:
            poppler_path = os.getenv("POPPLER_PATH") or None
            rendered_pages = convert_from_path(
                str(path),
                dpi=OCR_DPI,
                poppler_path=r"C:\Users\subhi\Downloads\Release-26.09.0-0\poppler-26.09.0\Library\bin",
            )
        except PDFInfoNotInstalledError as exc:
            raise OCRSetupError(
                "The PDF could not be rendered. Install Poppler and add its bin "
                "directory to PATH, or set POPPLER_PATH."
            ) from exc
        except (PDFPageCountError, PDFSyntaxError) as exc:
            raise OCRProcessingError(
                "The PDF is invalid or could not be rendered for OCR."
            ) from exc
        except (OSError, subprocess.SubprocessError, TimeoutError) as exc:
            raise OCRSetupError(
                "Poppler could not be started. Install Poppler and add its bin "
                "directory to PATH, or set POPPLER_PATH."
            ) from exc
        images = [
            cv2.cvtColor(np.asarray(page.convert("RGB")), cv2.COLOR_RGB2BGR)
            for page in rendered_pages
        ]
    else:
        encoded = np.fromfile(str(path), dtype=np.uint8)
        image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
        if image is None:
            raise OCRProcessingError("The uploaded image could not be decoded.")
        images = [image]

    if not images:
        raise OCRProcessingError("The document did not contain any pages.")

    return [_ocr_page(image, index) for index, image in enumerate(images, start=1)]