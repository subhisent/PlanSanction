# PlanSanction Python AI Service

This service accepts a building-plan PDF or image and returns page OCR, candidate
measurements, limited calculations from explicit high-confidence labels, and
configurable preliminary compliance checks. It does not approve plans. Final
legal approval remains with the authorized municipal officer.

## Install

From the `python-ai` directory, create and activate a virtual environment, then
install the Python dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

The service also requires the native Tesseract OCR executable. Install
Tesseract for Windows and either add `tesseract.exe` to `PATH` or set
`TESSERACT_CMD` to its full path. For PDFs, install Poppler for Windows and add
its `bin` directory to `PATH`, or set `POPPLER_PATH` to that directory. These
executables are separate from the packages installed by `pip`.

For example, set paths for the current PowerShell session:

```powershell
$env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
$env:POPPLER_PATH = "C:\path\to\poppler\Library\bin"
```

The OCR language defaults to English. Set `TESSERACT_LANG` to an installed
Tesseract language code if needed.

## Run

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Interactive API documentation is available at <http://127.0.0.1:8000/docs>.
The frontend CORS origins default to Vite development origins
`http://localhost:5173` and `http://127.0.0.1:5173`. Configure explicit
comma-separated origins with `CORS_ORIGINS`; wildcard origins are rejected.
`MAX_UPLOAD_SIZE_BYTES` defaults to 26,214,400 bytes (25 MiB).

## Endpoints

- `GET /` — service name and health status.
- `GET /health` — health status.
- `POST /analyze` — multipart form upload with a `file` field (PDF, PNG, JPEG).

The response distinguishes OCR candidates from validated calculations. OCR
confidence, explicit labels, and source coordinates are retained when present.
OCR values are estimates requiring verification; they are not treated as
validated inputs by compliance checks. FSI/FAR is only calculated from one
high-confidence, explicitly labelled plot area and total floor area.
Plot coverage and geometry-based setbacks are not inferred from OCR text.

## Preliminary rule configuration

The initial configuration is
`config/tamil_nadu_municipality_low_rise_residential.json`. It records the
requested scope but marks its context and all nine checks `UNVERIFIED`. It
contains no legal thresholds, official citations, or asserted rule versions.
Null provenance fields mean that the corresponding official source detail was
not verified; this configuration is not legally complete.

Set `RULE_CONFIG_PATH` in the Python service process to this JSON file (an
absolute path is least ambiguous; a relative path is resolved from the process
working directory). Each rule requires provenance fields and an explicit
verification status. A `VERIFIED` rule must have an operator (`min` or `max`),
a finite non-negative numeric value, and a unit. An `UNVERIFIED` rule must
leave `operator` and `value` null and will remain `NEEDS_REVIEW`.

To validate officer-entered measurements separately from OCR candidates, call
`validate_officer_confirmed_measurements()` or
`evaluate_officer_confirmed_compliance()` from `rule_engine.py`. Each submitted
measurement must contain `value`, `unit`, `confirmed_by`, `confirmed_at`
(ISO-8601), and `verification_status: "OFFICER_CONFIRMED"`. The validation
function returns accepted measurements and per-check errors; invalid inputs
are excluded from evaluation and therefore cannot produce `PASS` or `FAIL`.
OCR confidence is not accepted as officer confirmation. This helper is not
wired into the existing `/analyze` HTTP workflow, and this stage adds no
authentication or persistence. Officer confirmation in this helper is an
explicit input assertion, not proof of identity or a substitute for final
legal approval by the authorized municipal officer.

Missing context, unverified rules, missing/invalid measurements, or
incompatible units produce `NEEDS_REVIEW`; they are not treated as a pass.

## Tests

From the `python-ai` directory:

```powershell
python -m unittest discover -s tests -v
```
