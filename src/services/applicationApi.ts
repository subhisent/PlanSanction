
const API_BASE_URL = 'http://127.0.0.1:8080/api';

// Application returned by the Spring Boot backend.
export interface BackendApplication {
  id: number;
  applicationNumber: string;
  plotNumber: string | null;
  surveyNumber: string | null;
  plotArea: number | null;
  roadWidth?: number | null;
  buildingType: string | null;
  floors: number | null;
  status: string;
  submittedAt: string | null;
  updatedAt: string | null;
  officerRemarks?: string | null;
  rejectionReason?: string | null;
  complianceScore?: number | null;
}

// Request body for creating an application.
export interface CreateBackendApplicationRequest {
  applicantEmail: string;
  plotNumber: string;
  surveyNumber: string;
  plotArea: number;
  roadWidth: number;
  buildingType: string;
  floors: number;
}

// Metadata returned after uploading a document.
export interface BackendApplicationDocument {
  id: number;
  applicationId: number;
  version: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  uploadedAt: string | null;
}

// OCR-extracted room dimension candidate.
export interface RoomDimensionCandidate {
  type: string;
  room_name?: string;
  first_dimension: number;
  second_dimension: number;
  unit: string | null;
  source_page: number;
  source_text: string;
  line_text: string;
  is_estimate: boolean;
  requires_manual_review: boolean;
  review_reasons: string[];
}

// Response containing room dimension candidates.
export interface RoomDimensionsResponse {
  documentId: number;
  roomDimensionCount: number;
  roomDimensionCandidates: RoomDimensionCandidate[];
}

// Measurement saved after manual review.
export interface VerifiedMeasurement {
  id?: number;
  applicationId: number;
  documentId: number;
  extractedDataId: number | null;
  measurementType: string;
  originalValue1: number | null;
  originalValue2: number | null;
  verifiedValue1: number;
  verifiedValue2: number | null;
  unit: 'mm' | 'cm' | 'm' | 'ft' | 'in';
  verificationStatus: 'VERIFIED' | 'CORRECTED';
  officerId: number;
  officerRemarks: string;
  verifiedAt?: string | null;
}

// Request body for saving a measurement.
export type SaveVerifiedMeasurementRequest = Omit<
  VerifiedMeasurement,
  'id' | 'verifiedAt'
>;

// Read a successful response or report the backend error.
async function handleResponse<T>(
  response: Response,
  action: string
): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `${action} failed: HTTP ${response.status} ${errorText}`
    );
  }

  return (await response.json()) as T;
}

// Fetch all applications.
export async function fetchApplications(): Promise<BackendApplication[]> {
  const response = await fetch(`${API_BASE_URL}/applications`);

  return handleResponse<BackendApplication[]>(
    response,
    'Fetch applications'
  );
}

// Fetch applications assigned to an officer.
export async function fetchApplicationsForOfficer(
  officerId: number
): Promise<BackendApplication[]> {
  const response = await fetch(
    `${API_BASE_URL}/applications/officer/${officerId}`
  );

  return handleResponse<BackendApplication[]>(
    response,
    'Fetch officer applications'
  );
}

// Create an application in the backend.
export async function createBackendApplication(
  request: CreateBackendApplicationRequest
): Promise<BackendApplication> {
  const response = await fetch(`${API_BASE_URL}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<BackendApplication>(
    response,
    'Create application'
  );
}

// Upload a document to an existing application.
// The browser sets the multipart Content-Type boundary automatically.
export async function uploadApplicationDocument(
  applicationId: number,
  file: File,
  version = 1
): Promise<BackendApplicationDocument> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    throw new Error(
      'A valid application ID is required for document upload.'
    );
  }

  if (file.size === 0) {
    throw new Error(`The file "${file.name}" is empty.`);
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error(`The file "${file.name}" exceeds the 25 MB limit.`);
  }

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('version', String(version));

  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/documents`,
    {
      method: 'POST',
      body: formData,
    }
  );

  return handleResponse<BackendApplicationDocument>(
    response,
    `Upload document "${file.name}"`
  );
}

// Approve an application.
export async function approveBackendApplication(
  applicationId: number,
  remarks = 'Application approved by officer'
): Promise<BackendApplication> {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/approve`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks }),
    }
  );

  return handleResponse<BackendApplication>(
    response,
    'Approve application'
  );
}

// Request corrections from the applicant.
export async function requestBackendCorrections(
  applicationId: number,
  remarks: string
): Promise<BackendApplication> {
  if (!remarks.trim()) {
    throw new Error('Correction remarks are required.');
  }

  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/corrections`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks }),
    }
  );

  return handleResponse<BackendApplication>(
    response,
    'Request corrections'
  );
}

// Reject an application.
export async function rejectBackendApplication(
  applicationId: number,
  reason: string
): Promise<BackendApplication> {
  if (!reason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/reject`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    }
  );

  return handleResponse<BackendApplication>(
    response,
    'Reject application'
  );
}

// Retrieve OCR-extracted room dimension candidates for a document.
export async function fetchRoomDimensions(
  documentId: number
): Promise<RoomDimensionsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/analysis/documents/${documentId}/room-dimensions`
  );

  return handleResponse<RoomDimensionsResponse>(
    response,
    'Fetch room dimensions'
  );
}

// Save an officer-reviewed measurement to Spring Boot and MySQL.
export async function saveVerifiedMeasurement(
  request: SaveVerifiedMeasurementRequest
): Promise<VerifiedMeasurement> {
  const response = await fetch(
    `${API_BASE_URL}/verified-measurements`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  return handleResponse<VerifiedMeasurement>(
    response,
    'Save verified measurement'
  );
}

// Batch save multiple officer-reviewed measurements to MySQL.
export async function saveBatchVerifiedMeasurements(
  requests: SaveVerifiedMeasurementRequest[]
): Promise<VerifiedMeasurement[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/verified-measurements/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requests),
      }
    );
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('Batch endpoint failed, falling back to individual saves', err);
  }

  // Fallback sequential save
  const results: VerifiedMeasurement[] = [];
  for (const req of requests) {
    const saved = await saveVerifiedMeasurement(req);
    results.push(saved);
  }
  return results;
}

// Retrieve saved measurements for a document.
export async function fetchVerifiedMeasurementsForDocument(
  documentId: number
): Promise<VerifiedMeasurement[]> {
  const response = await fetch(
    `${API_BASE_URL}/verified-measurements/document/${documentId}`
  );

  return handleResponse<VerifiedMeasurement[]>(
    response,
    'Fetch saved measurements'
  );

}

  
export async function fetchApplicationDocuments(
  applicationId: number
): Promise<BackendApplicationDocument[]> {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/documents`
  );

  return handleResponse<BackendApplicationDocument[]>(
    response,
    'Fetch application documents'
  );
}

// Fetch a single application by ID or applicationNumber.
export async function fetchApplicationById(
  id: number | string
): Promise<BackendApplication> {
  const response = await fetch(`${API_BASE_URL}/applications/${id}`);

  return handleResponse<BackendApplication>(
    response,
    `Fetch application #${id}`
  );
}

// Direct URL for viewing/downloading an uploaded document file.
export function getDocumentFileUrl(
  applicationId: number,
  documentId: number
): string {
  return `${API_BASE_URL}/applications/${applicationId}/documents/${documentId}/file`;
}

// Scrutiny report from backend rule_results and extracted_data.
export interface BackendScrutinyReport {
  applicationId: number;
  hasAnalysis: boolean;
  metrics: {
    built_up_area?: number | null;
    ground_coverage_area?: number | null;
    ground_coverage_percent?: number | null;
    far?: number | null;
    building_height?: number | null;
    front_setback?: number | null;
    rear_setback?: number | null;
    side1_setback?: number | null;
    side2_setback?: number | null;
    parking_spaces?: number | null;
    raw_metadata_json?: string | null;
  };
  ruleResults: Array<{
    id: number;
    rule_code: string;
    rule_name: string;
    required_value: string;
    actual_value: string;
    status: 'PASS' | 'FAIL' | 'NEEDS_REVIEW' | 'NOT_APPLICABLE' | string;
    fix_hint: string | null;
    version: number;
    checked_at: string;
  }>;
  verifiedMeasurements: VerifiedMeasurement[];
}

// Retrieve the comprehensive technical scrutiny report for an application.
export async function fetchScrutinyReport(
  applicationId: number
): Promise<BackendScrutinyReport> {
  const response = await fetch(
    `${API_BASE_URL}/analysis/applications/${applicationId}/report`
  );

  return handleResponse<BackendScrutinyReport>(
    response,
    'Fetch scrutiny report'
  );
}

// Re-evaluate statutory rules using verified measurements.
export async function reevaluateRules(
  applicationId: number
): Promise<BackendScrutinyReport> {
  const response = await fetch(
    `${API_BASE_URL}/analysis/applications/${applicationId}/re-evaluate`,
    { method: 'POST' }
  );

  return handleResponse<BackendScrutinyReport>(
    response,
    'Re-evaluate scrutiny rules'
  );
}

// Status history entry.
export interface BackendStatusHistoryEntry {
  id: number;
  applicationId: number;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: number | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  remarks: string | null;
  createdAt: string;
}

// Fetch status history timeline for an application.
export async function fetchStatusHistory(
  applicationId: number
): Promise<BackendStatusHistoryEntry[]> {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/status-history`
  );

  return handleResponse<BackendStatusHistoryEntry[]>(
    response,
    'Fetch application status history'
  );
}

// Sanction certificate interface.
export interface BackendCertificate {
  id: number;
  certificateNumber: string;
  applicationId: number;
  applicationNumber: string;
  issuedByOfficerId: number;
  officerName?: string | null;
  officerEmail?: string | null;
  issueDate: string;
  expiryDate: string;
  verificationHash: string;
  plotNumber?: string | null;
  surveyNumber?: string | null;
  buildingType?: string | null;
  floors?: number | null;
  plotArea?: number | null;
  status: string;
  hasCertificate: boolean;
}

// Fetch official sanction certificate for an application.
export async function fetchCertificate(
  applicationId: number
): Promise<BackendCertificate> {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/certificate`
  );

  return handleResponse<BackendCertificate>(
    response,
    'Fetch sanction certificate'
  );
}

// Public verification of a certificate by certificate number or application number.
export async function verifyCertificatePublic(
  identifier: string
): Promise<BackendCertificate & { verified: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/applications/certificates/verify/${encodeURIComponent(identifier)}`
  );

  return handleResponse<BackendCertificate & { verified: boolean }>(
    response,
    'Verify sanction certificate'
  );
}

// Audit log entry.
export interface BackendAuditLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  timestamp: string;
}

// Fetch audit trail for an application.
export async function fetchAuditLogs(
  applicationId: number
): Promise<BackendAuditLog[]> {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/audit-logs`
  );

  return handleResponse<BackendAuditLog[]>(
    response,
    'Fetch audit trail'
  );
}


