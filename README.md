# PlanSanction — Smart City Municipal Building Plan Scrutiny & Statutory Approval Platform

> **Government of Tamil Nadu • Directorate of Town & Country Planning (DTCP)**  
> Production-grade 3-tier architecture for automated CAD/PDF plan scrutiny, officer measurement verification, and statutory sanction permit issuance under the **Tamil Nadu Combined Development and Building Rules, 2019 (TNCDBR 2019)**.

---

## 1. System Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            React 18 + Vite             │
                      │       TypeScript & Tailwind CSS        │
                      │               Port: 5173               │
                      └──────────────────┬─────────────────────┘
                                         │ REST (JSON)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │           Java Spring Boot             │
                      │       JDK 17 + Spring Data JPA         │
                      │               Port: 8080               │
                      └─────────┬────────────────────┬─────────┘
                                │                    │
                     HTTP / JSON│                    │ JDBC / SQL
                                ▼                    ▼
      ┌────────────────────────────────┐    ┌────────────────────────────────┐
      │       Python AI Service        │    │         MySQL Database         │
      │    FastAPI + Tesseract OCR     │    │      'municipal_approval'      │
      │           Port: 8000           │    │           Port: 3306           │
      └────────────────────────────────┘    └────────────────────────────────┘
```

### The Three Tiers:
1. **Frontend Tier (React + Vite + TypeScript)**:
   - Responsive Citizen & Municipal Officer portals.
   - Interactive CAD / PDF drawing viewer with dimension overlay.
   - Officer Action Desk for measurement verification and statutory sanction actions.
   - Public QR / Hash Certificate Verification Desk (`/verify/:applicationNo`).
2. **Business & Workflow Tier (Java Spring Boot 3 + OpenJDK 17)**:
   - Enforces the statutory municipal state machine (`SUBMITTED` -> `UNDER_AI_REVIEW` -> `OFFICER_REVIEW` -> `APPROVED` / `CORRECTIONS_REQUIRED` / `REJECTED`).
   - Secure document storage, path traversal protection, and file streaming.
   - Relational audit logging (`audit_logs`) and state change tracking (`application_status_history`).
   - Rule Scrutiny Engine evaluating verified dimensions against MySQL statutory rules.
   - SHA-256 cryptographic certificate generation and tamper-proof verification.
3. **AI & Computer Vision Tier (Python FastAPI + OpenCV + Tesseract OCR)**:
   - High-resolution PDF rasterization via `pdf2image` and `poppler`.
   - Drawing text and dimension annotation extraction with OCR confidence scoring.
   - Dimension candidate normalization (e.g. `1X4`, `12X14`) with unit-parsing and ambiguity detection.
   - Conservative rule engine returning `PASS`, `FAIL`, or `NEEDS_REVIEW` (never fabricating approvals).

---

## 2. Quick Start & Local Execution

### Prerequisites
- **Java**: Microsoft OpenJDK 17 (`java -version`)
- **Python**: Python 3.10+ (configured with virtualenv at `D:\PlanSanction\.venv`)
- **Node.js**: Node 18+ and `npm`
- **Database**: MySQL 8.0 running locally on port 3306 (database: `municipal_approval`)
- **Poppler / Tesseract**: Windows binaries configured in PATH / `C:\poppler\Library\bin`

---

### Step 1: Start the Python AI Service (Port 8000)
```powershell
cd D:\PlanSanction\PlanSanction\python-ai
& D:\PlanSanction\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*Health check:* `http://127.0.0.1:8000/health`  
*API Documentation (Swagger UI):* `http://127.0.0.1:8000/docs`

---

### Step 2: Start the Java Spring Boot Backend (Port 8080)
```powershell
cd D:\PlanSanction\PlanSanction\java-backend
.\mvnw.cmd spring-boot:run
```
*Health / API Base:* `http://127.0.0.1:8080/api/applications`

---

### Step 3: Start the Vite React Frontend (Port 5173)
```powershell
cd D:\PlanSanction\PlanSanction
npm run dev
```
*Application URL:* `http://localhost:5173`

---

## 3. End-to-End Workflow & OCR-to-Statutory Rule Pipeline

```
[1. Citizen Submits Application & PDF]
                  │
                  ▼
[2. Java Backend Stores Document & Creates DB Records]
                  │
                  ▼
[3. Python AI Rasterizes PDF & Runs OCR / Dimension Parsing]
                  │
                  ▼
[4. Dimension Candidates Saved (Status: NEEDS_REVIEW)]
                  │
                  ▼
[5. Municipal Officer Opens Plan Review Desk]
                  │
                  ├── Inspects CAD / PDF Drawing
                  ├── Reviews Extracted Dimension Candidates
                  └── Confirms / Corrects Values & Units (e.g., Front Setback = 3.5m)
                  │
                  ▼
[6. Backend Saves Verified Measurement & Triggers Rule Engine]
                  │
                  ├── Queries MySQL 'rules' table (MIN_ROAD_WIDTH, MIN_FRONT_SETBACK, MAX_FLOORS)
                  ├── Applies Unit Conversion (ft/in/cm/mm -> m)
                  └── Evaluates PASS / FAIL / NEEDS_REVIEW with statutory citations
                  │
                  ▼
[7. Officer Grants Final Statutory Sanction]
                  │
                  ├── Enforces valid state transition
                  ├── Emits audit event into 'audit_logs'
                  └── Generates Sanction Certificate with SHA-256 digital security hash
                  │
                  ▼
[8. Public & Citizen Verification]
                  │
                  └── Anyone can verify permit validity at /verify/:applicationNo
```

---

## 4. Key Statutory Rules (TNCDBR 2019)

| Rule ID | Parameter | Statutory Limit | Evaluation Input | Consequence |
|---|---|---|---|---|
| `MIN_ROAD_WIDTH` | Abutting Road Width | Minimum 9.0 metres | Site Metadata (`road_width`) | Mandatory for vehicle & fire access |
| `MAX_FLOORS` | Permissible Height / Floors | Maximum 4 Floors (Low-Rise) | Site Metadata (`floors`) | Exceeding shifts category to High-Rise |
| `MIN_FRONT_SETBACK` | Front Open Space | Minimum 3.0 metres | Officer-Verified `FRONT_SETBACK` | Ensures statutory setback from road boundary |
| `MAX_COVERAGE` | Ground Coverage | Maximum 60% of plot area | Verified Footprint / Plot Area | Prevents over-densification |
| `MAX_FAR` | Floor Area Ratio (FSI) | Maximum 2.5 | Total Built-Up Area / Plot Area | Governs allowable constructed volume |

> **Legal Decision Principle**: The AI pipeline is strictly a **decision-support tool**. It never autonomously grants statutory building sanction. The authorized municipal planning officer retains exclusive statutory authority.

---

## 5. Security & Audit Architecture

- **Tamper-Proof Audit Trail**: All status transitions, officer reviews, and approval actions are permanently logged in `application_status_history` and `audit_logs` with actor ID, IP address, timestamp, and transition rationale.
- **Cryptographic Sanction Permit**: When an application is approved, a SHA-256 verification hash is calculated over:
  `SHA256(certificateNumber + applicationId + officerId + issueDate + plotNumber + surveyNumber)`
  The resulting 64-character hex hash is displayed on the certificate and stored in MySQL, allowing anyone to verify authenticity via `GET /api/applications/certificates/verify/{identifier}` without database write access.
- **Safe File Handling**: Uploaded drawings are sanitized, UUID-indexed, and stored in versioned application folders outside the webroot to prevent path traversal attacks.

---

## 6. Placement & Interview Technical Defense Guide

This guide prepares you to explain the technical design and architectural choices during software engineering interviews:

### Q1: Why did you split the backend into Java Spring Boot and Python FastAPI?
> **Answer**:  
> "I adhered to the principle of **separation of concerns** and chose the best tool for each domain:
> - **Python** has the industry-standard computer vision and machine learning ecosystem (`OpenCV`, `pdf2image`, `pytesseract`, `NumPy`). Implementing image preprocessing, contrast enhancement, and OCR parsing in Python is clean, maintainable, and high-performance.
> - **Java Spring Boot** is enterprise-proven for transactional enterprise workflows, role-based security, state machines, and relational ORM with JPA/Hibernate. The municipal approval lifecycle requires ACID guarantees, audit trails, and strict status transitions, which Spring Boot excels at."

### Q2: How did you handle OCR inaccuracy or ambiguity in architectural drawings?
> **Answer**:  
> "Architectural drawings contain complex annotations like dimension lines, room labels (e.g. `10' x 12'`), and scale ratios that can mislead traditional OCR. Rather than blindly trusting OCR output:
> 1. The extraction service generates **candidates** with source page references, parsed values, and confidence flags.
> 2. We deliberately enforce a **Human-in-the-Loop verification pattern**. Every candidate is flagged as `NEEDS_REVIEW` until an authorized planning officer inspects the visual PDF, confirms or corrects the dimension and units, and commits a verified measurement.
> 3. This guarantees that statutory compliance checks are only computed against **officer-confirmed measurements**, preventing false approvals while drastically reducing manual transcription effort."

### Q3: How does the statutory rule engine work?
> **Answer**:  
> "The rule engine is data-driven and backed by the MySQL `rules` table containing TNCDBR 2019 parameters. When an officer confirms a dimension (such as a front setback of 3.5m), the backend:
> - Normalizes units to standard metres (handling conversions from feet, inches, cm, mm).
> - Retrieves the active rule from MySQL.
> - Compares the verified measurement against the threshold.
> - Commits a structured evaluation (`PASS`, `FAIL`, or `NEEDS_REVIEW`) into `rule_results` along with exact statutory clause citations.
> If any critical measurement is missing, the engine strictly outputs `NEEDS_REVIEW` instead of fabricating compliance."

### Q4: How is the state machine enforced?
> **Answer**:  
> "State transitions are guarded in the Spring Boot service layer. For example, an application cannot be approved if it is already approved or rejected. When a valid transition occurs:
> - The application record is updated within an `@Transactional` boundary.
> - A record is appended to `application_status_history` logging the previous state, new state, officer ID, and timestamp.
> - An audit entry is written to `audit_logs` capturing user details, action, and IP address for compliance tracking."

### Q5: How does the public certificate verification work?
> **Answer**:  
> "Upon approval, the backend creates an immutable entry in the `certificates` table. We generate an official certificate number (e.g. `TN-SANCTION-2026-PS-71446F40`) and compute a deterministic SHA-256 cryptographic hash combining the permit number, application ID, officer ID, issue date, and survey coordinates. A public REST endpoint allows citizens or municipal auditors to look up the permit and verify the cryptographic signature without requiring authentication."

---

## 7. Automated Test Suite

### Java Spring Boot Backend Tests
```powershell
cd D:\PlanSanction\PlanSanction\java-backend
.\mvnw.cmd clean test
```
*Coverage*: Application CRUD, Document Upload, Verified Measurement Persistence, TNCDBR Rule Evaluation, Approval State Machine, and Certificate Issuance.

### Python AI Service Tests
```powershell
cd D:\PlanSanction\PlanSanction\python-ai
& D:\PlanSanction\.venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
```
*Coverage*: OCR text parsing, dimension candidate extraction, unit conversion, geometric calculations, and TNCDBR rule evaluation contracts.

### Frontend TypeScript Build & Lint
```powershell
cd D:\PlanSanction\PlanSanction
npm run build
```
*Coverage*: Strict TypeScript compilation and Vite production bundle optimization.

---

## 8. License & Attribution

Developed under academic research for Smart City Municipal E-Governance, benchmarking against the **Tamil Nadu Combined Development and Building Rules, 2019 (TNCDBR 2019)**.  
*Note: AI assistance provides technical decision-support only. Final statutory authority rests with the designated municipal planning officer.*
