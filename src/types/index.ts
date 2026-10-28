export type UserRole = 'client' | 'officer';

export type Region = 'Tiruchengode' | 'Rasipuram' | 'Kumarapalayam' | 'Paramathi-Velur';
export type District = 'Namakkal';

export type BuildingType = 'residential' | 'commercial' | 'industrial' | 'institutional';

export type ApplicationStatus =
  | 'submitted'
  | 'under_ai_review'
  | 'officer_review'
  | 'correction_required'
  | 'approved'
  | 'rejected';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  region: Region;
  district: District;
  designation?: string;
  createdAt: string;
}

export interface PlotDetails {
  surveyNo: string;
  pattaNo?: string;
  ward: string;
  doorNo?: string;
  street: string;
  village: string;
  taluk: Region;
  region: Region;
  district: District;
  abuttingRoadWidthM: number;
  frontageM: number;
}

export interface Setbacks {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export interface UploadedPlanFile {
  name: string;
  type: 'pdf' | 'dwg' | 'dxf' | 'image';
  storagePath: string;
  originalStoragePath?: string;
  sizeBytes: number;
  url?: string;
  uploadedAt: string;
  ocr?: import('../services/planOcr').PlanOcrResult;
  dxfInfo?: {
    layers: string[];
    boundingBox?: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      width: number;
      height: number;
    };
    lineCount?: number;
    textCount?: number;
    notes?: string[];
  };
}

export interface RuleCheckResult {
  rule: string;
  ruleRef: string; // e.g. "TNCDBR Rule 35(1)"
  required: string;
  found: string;
  status: 'pass' | 'fail' | 'needs_manual_check';
  severity: 'low' | 'medium' | 'high';
  remark: string;
}

export interface CorrectionPoint {
  id: string;
  point: string;
  section: string;
  ruleRef?: string;
  raisedBy: string; // Officer UID or 'AI'
  raisedAt: string;
  resolved: boolean;
  resolutionNote?: string;
  resolvedAt?: string;
}

export interface AIReport {
  summary: string;
  complianceScore: number; // 0-100
  recommendation: 'approve' | 'approve_with_conditions' | 'correction_required' | 'reject';
  checks: RuleCheckResult[];
  correctionPoints: Array<{
    point: string;
    section: string;
    ruleRef?: string;
  }>;
  analyzedAt: string;
  model: string;
  error?: string;
}

export interface TimelineEntry {
  id: string;
  status: ApplicationStatus;
  note: string;
  actor: string; // User ID or 'System' / 'AI Engine'
  actorName: string;
  role: string;
  at: string;
}

export interface BuildingApplication {
  id: string;
  applicationNo: string; // NMK/TCG/2026/0001
  applicantId: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  applicantAadhaar?: string;
  applicantAddress?: string;

  plotDetails: PlotDetails;
  buildingType: BuildingType;
  plotAreaSqm: number;
  builtUpAreaSqm: number;
  groundCoverageSqm?: number;
  groundCoveragePercentage?: number;
  fsi: number; // Floor Space Index
  floors: number;
  proposedHeightM: number;
  setbacks: Setbacks;

  parkingSpacesCar: number;
  parkingSpacesTwoWheeler: number;
  rainwaterHarvestingProvided: boolean;
  staircaseWidthM: number;

  files: UploadedPlanFile[];
  aiReport?: AIReport;
  status: ApplicationStatus;
  corrections: CorrectionPoint[];
  timeline: TimelineEntry[];

  sanctionOrderNo?: string;
  certificateUrl?: string;
  officerNotes?: string;
  conditions?: string[];
  rejectionReason?: string;

  assignedOfficerId?: string;
  assignedOfficerName?: string;

  submittedAt: string;
  updatedAt: string;
  decidedAt?: string;
}

export interface DistrictStats {
  totalApplications: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  correctionRequiredCount: number;
  averageTurnaroundDays: number;
  approvalRatePercent: number;
  regionalBreakdown: {
    region: Region;
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    avgDays: number;
    officerName: string;
  }[];
  monthlyTrend: {
    month: string;
    submitted: number;
    approved: number;
    rejected: number;
  }[];
  statusSplit: {
    name: string;
    value: number;
    color: string;
  }[];
  violationStats: {
    rule: string;
    count: number;
    severity: string;
  }[];
}
