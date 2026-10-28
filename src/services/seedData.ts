import { BuildingApplication, UserProfile, DistrictStats, UploadedPlanFile, TimelineEntry } from '../types';
import { evaluateTNCDBRCompliance } from './tncdbrRules';

export const DEMO_USERS: UserProfile[] = [
  {
    uid: 'demo-client-001',
    name: 'S. K. Murugesan & Associates',
    email: 'client@plansanction.tn.gov.in',
    role: 'client',
    phone: '+91 94432 18765',
    region: 'Tiruchengode',
    district: 'Namakkal',
    designation: 'Registered Architect / Property Developer',
    createdAt: '2025-10-15T09:00:00Z',
  },
  {
    uid: 'demo-officer-tcg',
    name: 'Er. K. Ramesh, B.E. (Civil)',
    email: 'officer.tcg@plansanction.tn.gov.in',
    role: 'officer',
    phone: '+91 98421 54321',
    region: 'Tiruchengode',
    district: 'Namakkal',
    designation: 'Assistant Director / Scrutiny Planning Officer',
    createdAt: '2025-08-01T09:00:00Z',
  },
  {
    uid: 'demo-officer-rsp',
    name: 'Er. M. Anitha, M.Tech (Town Planning)',
    email: 'officer.rsp@plansanction.tn.gov.in',
    role: 'officer',
    phone: '+91 98427 65432',
    region: 'Rasipuram',
    district: 'Namakkal',
    designation: 'Executive Engineer / Planning Officer',
    createdAt: '2025-08-01T09:00:00Z',
  },
  {
    uid: 'demo-officer-kmp',
    name: 'Er. P. Venkatesh, B.E.',
    email: 'officer.kmp@plansanction.tn.gov.in',
    role: 'officer',
    phone: '+91 97890 12345',
    region: 'Kumarapalayam',
    district: 'Namakkal',
    designation: 'Municipal Town Planning Officer',
    createdAt: '2025-08-01T09:00:00Z',
  },
  {
    uid: 'demo-officer-pmv',
    name: 'Er. R. Soundararajan, B.E.',
    email: 'officer.pmv@plansanction.tn.gov.in',
    role: 'officer',
    phone: '+91 94422 99881',
    region: 'Paramathi-Velur',
    district: 'Namakkal',
    designation: 'Assistant Director / Town Planning',
    createdAt: '2025-08-01T09:00:00Z',
  }
];

const REGION_PREFIXES: Record<string, string> = {
  'Tiruchengode': 'TCG',
  'Rasipuram': 'RSP',
  'Kumarapalayam': 'KMP',
  'Paramathi-Velur': 'PMV'
};

const SAMPLE_APPLICANTS = [
  'S. K. Murugesan & Associates',
  'K. V. Ramasamy Gounder & Sons',
  'Sri Selvam Real Estates Ltd',
  'P. Dhanalakshmi & Brothers',
  'Kongu Builders & Promoters',
  'N. Chinnasamy Infra Pvt Ltd',
  'R. Saravanan (Greenfield Layout)',
  'Dr. T. Vijayakumar',
  'M/s. Namakkal Poultries & Mills',
  'A. Revathi & Family',
  'Subramaniam Textiles & Garments',
  'Cauvery Commercial Ventures',
  'M. Gomathi Ammal',
  'S. Balasubramanian (Dev Developers)',
  'T. K. Mohanraj Properties',
  'V. Latha & V. Senthilkumar',
  'Annapoorna Hotel Complex Pvt Ltd',
  'Jai Maruthi Warehousing Logistics',
  'K. Natarajan & Bros',
  'G. Muthukumar',
];

const SAMPLE_STREETS = [
  'Sankari Main Road',
  'Velur Road, Anna Nagar',
  'Kollapatty Bypass',
  'Salem Highway, Ward 4',
  'Cauvery Bridge Approach Rd',
  'Gandhi Ashram Road',
  'Periyar Nagar 2nd Cross',
  'Bhavani Main Road',
  'Town Hall Extension',
  'Kailasampalayam Ring Road',
  'Thuraiyur Road, Ward 12',
  'Tiruchengode Hill Temple Road',
];

export function generateRealisticApplications(): BuildingApplication[] {
  const regions: ('Tiruchengode' | 'Rasipuram' | 'Kumarapalayam' | 'Paramathi-Velur')[] = [
    'Tiruchengode',
    'Rasipuram',
    'Kumarapalayam',
    'Paramathi-Velur'
  ];

  const buildingTypes: ('residential' | 'commercial' | 'industrial' | 'institutional')[] = [
    'residential',
    'residential',
    'commercial',
    'residential',
    'commercial',
    'industrial',
    'institutional'
  ];

  const statuses: ('submitted' | 'under_ai_review' | 'officer_review' | 'correction_required' | 'approved' | 'rejected')[] = [
    'approved',
    'approved',
    'approved',
    'officer_review',
    'correction_required',
    'submitted',
    'under_ai_review',
    'rejected'
  ];

  const applications: BuildingApplication[] = [];
  let seq = 100;

  // Generate 42 realistic applications spread over past 8 months
  for (let i = 0; i < 42; i++) {
    seq++;
    const region = regions[i % regions.length];
    const prefix = REGION_PREFIXES[region];
    const buildingType = buildingTypes[i % buildingTypes.length];
    const applicantName = (i === 0 || i === 4 || i === 12 || i === 25) ? 'S. K. Murugesan & Associates' : SAMPLE_APPLICANTS[i % SAMPLE_APPLICANTS.length];
    const applicantId = applicantName === 'S. K. Murugesan & Associates' ? 'demo-client-001' : `applicant-${i + 100}`;

    // Dates distributed across Oct 2025 - Sep 2026
    const daysAgo = (42 - i) * 6;
    const submittedDate = new Date(2026, 8, 17); // Sep 17, 2026 reference
    submittedDate.setDate(submittedDate.getDate() - daysAgo);

    const isRecent = daysAgo <= 5;
    let status = statuses[i % statuses.length];
    if (isRecent) {
      status = i % 2 === 0 ? 'submitted' : 'under_ai_review';
    }

    const appNo = `NMK/${prefix}/2026/${String(seq).padStart(4, '0')}`;
    const plotAreaSqm = 120 + (i * 27) % 450;
    const floors = buildingType === 'commercial' ? (i % 3) + 2 : (i % 2) + 2; // 2 to 4 floors
    const builtUpAreaSqm = Number((plotAreaSqm * (1.1 + (i % 5) * 0.25)).toFixed(1));
    const proposedHeightM = Number((floors * 3.1 + 0.6).toFixed(1));
    const roadWidthM = [7.5, 9.0, 12.0, 15.0, 18.0][i % 5];
    const frontageM = 10 + (i % 8) * 2;

    // Setbacks
    const hasSetbackDeficit = status === 'correction_required';
    const setbacks = {
      front: hasSetbackDeficit ? 1.2 : Number((2.0 + (i % 3) * 0.8).toFixed(1)),
      rear: hasSetbackDeficit ? 0.9 : Number((1.5 + (i % 2) * 0.5).toFixed(1)),
      left: Number((1.2 + (i % 2) * 0.4).toFixed(1)),
      right: Number((1.5 + (i % 3) * 0.3).toFixed(1)),
    };

    const parkingSpacesCar = buildingType === 'residential' ? Math.max(1, Math.floor(builtUpAreaSqm / 140)) : Math.max(2, Math.floor(builtUpAreaSqm / 70));
    const parkingSpacesTwoWheeler = Math.max(2, Math.floor(builtUpAreaSqm / 50));
    const rwh = status !== 'correction_required' || i % 2 === 0;

    const evalResult = evaluateTNCDBRCompliance({
      plotAreaSqm,
      builtUpAreaSqm,
      buildingType,
      floors,
      proposedHeightM,
      abuttingRoadWidthM: roadWidthM,
      frontageM,
      setbacks,
      parkingSpacesCar,
      parkingSpacesTwoWheeler,
      staircaseWidthM: buildingType === 'commercial' ? 1.5 : 1.2,
      rainwaterHarvestingProvided: rwh
    });

    // Sample CAD and PDF Files
    const files: UploadedPlanFile[] = [
      {
        name: `Architectural_Plan_${appNo.replace(/\//g, '_')}.pdf`,
        type: 'pdf',
        storagePath: `plans/${appNo}/plan.pdf`,
        sizeBytes: 4120000 + (i * 120000),
        uploadedAt: submittedDate.toISOString(),
        url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf'
      },
      {
        name: `Site_Layout_Drawing_${prefix}_${seq}.dxf`,
        type: 'dxf',
        storagePath: `plans/${appNo}/drawing.dxf`,
        sizeBytes: 1850000,
        uploadedAt: submittedDate.toISOString(),
        dxfInfo: {
          layers: ['0', 'SITE_BOUNDARY', 'SETBACK_LINES', 'GROUND_FLOOR', 'FIRST_FLOOR', 'RWH_PIT', 'PARKING_BAYS', 'DIMENSIONS'],
          boundingBox: { minX: 0, minY: 0, maxX: frontageM, maxY: Number((plotAreaSqm / frontageM).toFixed(1)), width: frontageM, height: Number((plotAreaSqm / frontageM).toFixed(1)) },
          lineCount: 140 + (i * 15),
          textCount: 28 + (i * 3),
          notes: [`SURVEY NO. ${120 + i}/3B`, `TALUK: ${region}`, `ROAD: ${roadWidthM}m`, 'TNCDBR 2019 COMPLIANT']
        }
      }
    ];

    if (i % 3 === 0) {
      files.push({
        name: `Structural_Details_${seq}.dwg`,
        type: 'dwg',
        storagePath: `plans/${appNo}/structural.dwg`,
        sizeBytes: 6200000,
        uploadedAt: submittedDate.toISOString()
      });
    }

    // Timeline
    const timeline: TimelineEntry[] = [
      {
        id: `tl-${i}-1`,
        status: 'submitted',
        note: `Application submitted online by ${applicantName} with required fee.`,
        actor: applicantId,
        actorName: applicantName,
        role: 'Applicant',
        at: submittedDate.toISOString()
      },
      {
        id: `tl-${i}-2`,
        status: 'under_ai_review',
        note: 'Automated AI Scrutiny engine initiated check against TNCDBR 2019 rules.',
        actor: 'system',
        actorName: 'TNCDBR Scrutiny Engine',
        role: 'System',
        at: new Date(submittedDate.getTime() + 1000 * 60 * 5).toISOString()
      }
    ];

    let decidedAt: string | undefined = undefined;
    let sanctionOrderNo: string | undefined = undefined;
    const officerName = `Er. ${region === 'Tiruchengode' ? 'K. Ramesh' : region === 'Rasipuram' ? 'M. Anitha' : region === 'Kumarapalayam' ? 'P. Venkatesh' : 'R. Soundararajan'}, Planning Officer`;

    if (status === 'officer_review') {
      timeline.push({
        id: `tl-${i}-3`,
        status: 'officer_review' as const,
        note: `AI Scrutiny report generated (Score: ${evalResult.complianceScore}%). Assigned to ${officerName} for technical inspection.`,
        actor: 'system',
        actorName: 'LPA Dispatch',
        role: 'System',
        at: new Date(submittedDate.getTime() + 1000 * 60 * 15).toISOString()
      });
    } else if (status === 'correction_required') {
      timeline.push({
        id: `tl-${i}-3`,
        status: 'correction_required' as const,
        note: `Correction notice issued. Discrepancies identified in Setbacks and FSI rules. Architect required to revise drawings.`,
        actor: 'demo-officer-tcg',
        actorName: officerName,
        role: 'Planning Officer',
        at: new Date(submittedDate.getTime() + 1000 * 60 * 60 * 24).toISOString()
      });
    } else if (status === 'approved') {
      decidedAt = new Date(submittedDate.getTime() + 1000 * 60 * 60 * 48).toISOString();
      sanctionOrderNo = `TN/NMK/${prefix}/BLD/2026/${String(seq).padStart(4, '0')}`;
      timeline.push({
        id: `tl-${i}-3`,
        status: 'officer_review' as const,
        note: `Technical scrutiny verified by ${officerName}. Site inspection found satisfactory.`,
        actor: 'demo-officer-tcg',
        actorName: officerName,
        role: 'Planning Officer',
        at: new Date(submittedDate.getTime() + 1000 * 60 * 60 * 24).toISOString()
      });
      timeline.push({
        id: `tl-${i}-4`,
        status: 'approved' as const,
        note: `Building Plan Sanction Order ${sanctionOrderNo} approved and digitally sealed.`,
        actor: 'demo-officer-tcg',
        actorName: officerName,
        role: 'Planning Officer',
        at: decidedAt
      });
    } else if (status === 'rejected') {
      decidedAt = new Date(submittedDate.getTime() + 1000 * 60 * 60 * 36).toISOString();
      timeline.push({
        id: `tl-${i}-3`,
        status: 'rejected' as const,
        note: `Proposal rejected due to unresolvable road width non-conformance under Rule 35.`,
        actor: 'demo-officer-tcg',
        actorName: officerName,
        role: 'Planning Officer',
        at: decidedAt
      });
    }

    const corrections = evalResult.correctionPoints.map((cp, idx) => ({
      id: `corr-${i}-${idx + 1}`,
      point: cp.point,
      section: cp.section,
      ruleRef: cp.ruleRef,
      raisedBy: officerName,
      raisedAt: submittedDate.toISOString(),
      resolved: status === 'approved'
    }));

    applications.push({
      id: `app-${prefix.toLowerCase()}-${seq}`,
      applicationNo: appNo,
      applicantId,
      applicantName,
      applicantPhone: '+91 94432 ' + String(10000 + i),
      applicantEmail: applicantName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@gmail.com',
      applicantAadhaar: 'XXXX-XXXX-' + String(2000 + i),
      applicantAddress: `${10 + i}, ${SAMPLE_STREETS[i % SAMPLE_STREETS.length]}, ${region}, Namakkal - 637211`,
      plotDetails: {
        surveyNo: `${100 + i}/${(i % 4) + 1}${(i % 2 === 0 ? 'A' : 'B')}`,
        pattaNo: `PTA/${2026}/${4000 + i}`,
        ward: `Ward ${((i % 18) + 1)}`,
        street: SAMPLE_STREETS[i % SAMPLE_STREETS.length],
        village: `${region} Town`,
        taluk: region,
        region: region,
        district: 'Namakkal',
        abuttingRoadWidthM: roadWidthM,
        frontageM
      },
      buildingType,
      plotAreaSqm,
      builtUpAreaSqm,
      groundCoveragePercentage: Math.min(68, Math.round((builtUpAreaSqm / (floors * plotAreaSqm)) * 100)),
      fsi: Number((builtUpAreaSqm / plotAreaSqm).toFixed(2)),
      floors,
      proposedHeightM,
      setbacks,
      parkingSpacesCar,
      parkingSpacesTwoWheeler,
      rainwaterHarvestingProvided: rwh,
      staircaseWidthM: buildingType === 'commercial' ? 1.5 : 1.2,
      files,
      aiReport: {
        summary: evalResult.summary,
        complianceScore: evalResult.complianceScore,
        recommendation: evalResult.recommendation,
        checks: evalResult.checks.map(c => ({
          rule: c.rule,
          ruleRef: c.ruleRef,
          required: c.required,
          found: c.found,
          status: c.isCompliant ? 'pass' : 'fail',
          severity: c.severity,
          remark: c.remark
        })),
        correctionPoints: evalResult.correctionPoints,
        analyzedAt: submittedDate.toISOString(),
        model: 'gemini-2.0-flash (TNCDBR Engine)'
      },
      status,
      corrections,
      timeline,
      sanctionOrderNo,
      submittedAt: submittedDate.toISOString(),
      updatedAt: (decidedAt || submittedDate.toISOString()),
      decidedAt,
      assignedOfficerName: officerName
    });
  }

  return applications;
}

export function calculateDistrictStats(apps: BuildingApplication[]): DistrictStats {
  const total = apps.length;
  const approved = apps.filter(a => a.status === 'approved').length;
  const pending = apps.filter(a => a.status === 'submitted' || a.status === 'under_ai_review' || a.status === 'officer_review').length;
  const rejected = apps.filter(a => a.status === 'rejected').length;
  const correction = apps.filter(a => a.status === 'correction_required').length;

  const approvalRatePercent = total > 0 ? Math.round((approved / total) * 100) : 0;

  const regions: ('Tiruchengode' | 'Rasipuram' | 'Kumarapalayam' | 'Paramathi-Velur')[] = [
    'Tiruchengode',
    'Rasipuram',
    'Kumarapalayam',
    'Paramathi-Velur'
  ];

  const regionalBreakdown = regions.map(reg => {
    const regApps = apps.filter(a => a.plotDetails.region === reg);
    const regApproved = regApps.filter(a => a.status === 'approved').length;
    const regPending = regApps.filter(a => a.status === 'submitted' || a.status === 'under_ai_review' || a.status === 'officer_review').length;
    const regRejected = regApps.filter(a => a.status === 'rejected').length;
    const officer = DEMO_USERS.find(u => u.role === 'officer' && u.region === reg)?.name || 'Planning Officer';

    // Average days calculation
    const avgDays = reg === 'Kumarapalayam' ? 4.8 : reg === 'Tiruchengode' ? 2.4 : reg === 'Rasipuram' ? 2.9 : 3.1;

    return {
      region: reg,
      total: regApps.length,
      approved: regApproved,
      pending: regPending,
      rejected: regRejected,
      avgDays,
      officerName: officer
    };
  });

  // Monthly trend for past 8 months
  const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const monthlyTrend = months.map((m, idx) => {
    const sub = 3 + (idx * 2) + ((idx % 3) * 2);
    const app = Math.max(1, Math.round(sub * 0.75));
    const rej = Math.max(0, sub - app - 1);
    return {
      month: m,
      submitted: sub,
      approved: app,
      rejected: rej
    };
  });

  const statusSplit = [
    { name: 'Approved', value: approved, color: '#10b981' },
    { name: 'Officer Review', value: apps.filter(a => a.status === 'officer_review').length, color: '#3b82f6' },
    { name: 'AI Review / Submitted', value: apps.filter(a => a.status === 'submitted' || a.status === 'under_ai_review').length, color: '#8b5cf6' },
    { name: 'Correction Required', value: correction, color: '#f59e0b' },
    { name: 'Rejected', value: rejected, color: '#ef4444' },
  ];

  // Most violated rules
  const violationCounts: Record<string, { count: number; severity: string }> = {
    'Floor Space Index (FSI) Limit (Rule 35)': { count: 14, severity: 'high' },
    'Inadequate Front Setback (Rule 38(2))': { count: 12, severity: 'high' },
    'Missing Rainwater Harvesting Details (Rule 45)': { count: 9, severity: 'high' },
    'Insufficient Off-Street Car Parking (Rule 42)': { count: 7, severity: 'medium' },
    'Rear Setback Clearance Deficit (Rule 38(3))': { count: 6, severity: 'medium' },
    'Staircase Egress Width Shortfall (Rule 48)': { count: 4, severity: 'medium' },
  };

  const violationStats = Object.entries(violationCounts).map(([rule, data]) => ({
    rule,
    count: data.count,
    severity: data.severity
  }));

  return {
    totalApplications: total,
    approvedCount: approved,
    pendingCount: pending,
    rejectedCount: rejected,
    correctionRequiredCount: correction,
    averageTurnaroundDays: 3.2,
    approvalRatePercent,
    regionalBreakdown,
    monthlyTrend,
    statusSplit,
    violationStats
  };
}
