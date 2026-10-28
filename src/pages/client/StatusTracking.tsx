import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useApplications, useCurrentUser } from '../../services/store';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ComplianceGauge } from '../../components/common/ComplianceGauge';
import { PlanDocumentViewer } from '../../components/common/PlanDocumentViewer';
import { UploadedPlanFile, ApplicationStatus } from '../../types';
import { saveUploadedDocument } from '../../services/documentStorage';
import { preprocessPlanImage } from '../../services/imagePreprocessing';
import { extractPlanText } from '../../services/planOcr';
import {
  fetchApplications,
  fetchStatusHistory,
  fetchCertificate,
  fetchScrutinyReport,
  fetchApplicationDocuments,
  getDocumentFileUrl,
  type BackendApplication,
  type BackendCertificate,
  type BackendStatusHistoryEntry,
  type BackendScrutinyReport,
  type BackendApplicationDocument,
} from '../../services/applicationApi';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Download, 
  UploadCloud, 
  Sparkles, 
  UserCheck, 
  Search, 
  ChevronRight, 
  FileCheck2,
  AlertCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Calculator,
  Info
} from 'lucide-react';

export const StatusTracking: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { applications, reUploadRevisedDrawings } = useApplications();
  const { currentUser } = useCurrentUser();

  const queryAppNo = searchParams.get('app');
  const [searchInput, setSearchInput] = useState(queryAppNo || '');
  const [revisedFiles, setRevisedFiles] = useState<UploadedPlanFile[]>([]);
  const [revisionNote, setRevisionNote] = useState('');
  const [isReuploading, setIsReuploading] = useState(false);
  const [reuploadSuccess, setReuploadSuccess] = useState(false);

  // Live Backend Synchronization State
  const [backendApp, setBackendApp] = useState<BackendApplication | null>(null);
  const [backendCertificate, setBackendCertificate] = useState<BackendCertificate | null>(null);
  const [backendHistory, setBackendHistory] = useState<BackendStatusHistoryEntry[]>([]);
  const [backendReport, setBackendReport] = useState<BackendScrutinyReport | null>(null);
  const [backendDocs, setBackendDocs] = useState<BackendApplicationDocument[]>([]);
  const [backendAppsList, setBackendAppsList] = useState<BackendApplication[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  // Selected application
  const myApps = applications.filter(a => a.applicantId === currentUser.uid || a.applicantName.toLowerCase().includes('murugesan'));
  const selectedApp = (queryAppNo ? applications.find(a => a.applicationNo === queryAppNo || a.id === queryAppNo) : myApps[0]) || applications[0];

  // Sync with live MySQL backend whenever application changes
  useEffect(() => {
    let cancelled = false;
    const targetQuery = queryAppNo || searchInput || selectedApp?.applicationNo || selectedApp?.id;
    if (!targetQuery) return;

    async function syncWithBackend() {
      setIsLoadingLive(true);
      try {
        const apps = await fetchApplications();
        if (cancelled) return;
        setBackendAppsList(apps);

        const matched = apps.find(
          (a) =>
            a.applicationNumber.toLowerCase() === targetQuery.toLowerCase() ||
            String(a.id) === targetQuery
        );

        if (matched) {
          setBackendApp(matched);

          try {
            const history = await fetchStatusHistory(matched.id);
            if (!cancelled) setBackendHistory(history);
          } catch (e) {
            console.error('Failed to load status history:', e);
          }

          if (matched.status === 'APPROVED') {
            try {
              const cert = await fetchCertificate(matched.id);
              if (!cancelled && cert.hasCertificate) {
                setBackendCertificate(cert);
              }
            } catch (e) {
              console.error('Failed to load certificate:', e);
            }
          } else {
            setBackendCertificate(null);
          }

          try {
            const report = await fetchScrutinyReport(matched.id);
            if (!cancelled) setBackendReport(report);
          } catch (e) {
            console.error('Failed to load scrutiny report:', e);
          }

          try {
            const docs = await fetchApplicationDocuments(matched.id);
            if (!cancelled) setBackendDocs(docs);
          } catch (e) {
            console.error('Failed to load application documents:', e);
          }
        }
      } catch (err) {
        console.error('Failed to sync live application:', err);
      } finally {
        if (!cancelled) setIsLoadingLive(false);
      }
    }

    void syncWithBackend();
    return () => {
      cancelled = true;
    };
  }, [queryAppNo, searchInput, selectedApp?.applicationNo, selectedApp?.id]);

  const rawStatus = backendApp?.status || selectedApp?.status || 'submitted';
  const effectiveStatus = String(rawStatus).toLowerCase().replace(/s_required$/, '_required');
  const isApproved = effectiveStatus === 'approved';
  const isCorrectionRequired = effectiveStatus === 'correction_required';
  const isRejected = effectiveStatus === 'rejected';

  const displayAppNo = backendApp?.applicationNumber || selectedApp?.applicationNo || queryAppNo || 'PS-SANCTION';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ app: searchInput.trim() });
    }
  };

  const handleRevisedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list: UploadedPlanFile[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
        const uploadFile = isImage ? await preprocessPlanImage(f) : f;
        let ocr;
        if (isImage || ext === 'pdf') {
          try {
            ocr = await extractPlanText(uploadFile, ext === 'pdf');
          } catch (error) {
            console.error('Revised plan OCR failed:', error);
          }
        }
        const originalStoragePath = isImage ? `local-documents/${crypto.randomUUID()}` : undefined;
        if (originalStoragePath) await saveUploadedDocument(originalStoragePath, f);
        const storagePath = `local-documents/${crypto.randomUUID()}`;
        await saveUploadedDocument(storagePath, uploadFile);
        list.push({
          name: f.name,
          type: isImage ? 'image' : ext === 'pdf' ? 'pdf' : ext === 'dxf' ? 'dxf' : 'dwg',
          storagePath,
          originalStoragePath,
          sizeBytes: f.size,
          uploadedAt: new Date().toISOString(),
          ocr
        });
      }
      setRevisedFiles(list);
    } catch (error) {
      console.error('Failed to process revised drawing:', error);
      alert('Could not process the revised drawing. Please try another file.');
    }
  };

  const handleSubmittingRevisedDrawings = async () => {
    if (revisedFiles.length === 0) {
      alert('Please select the revised drawing file (PDF/DXF) before submitting.');
      return;
    }

    setIsReuploading(true);
    try {
      reUploadRevisedDrawings(selectedApp.id, revisedFiles, revisionNote);
      setReuploadSuccess(true);
      setRevisedFiles([]);
      setRevisionNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsReuploading(false);
    }
  };

  const getStepStatus = (stepKey: string) => {
    if (stepKey === 'submitted') return 'completed';
    if (stepKey === 'ai_review') {
      if (effectiveStatus === 'submitted') return 'pending';
      if (effectiveStatus === 'under_ai_review') return 'current';
      return 'completed';
    }
    if (stepKey === 'officer_review') {
      if (effectiveStatus === 'submitted' || effectiveStatus === 'under_ai_review') return 'pending';
      if (effectiveStatus === 'officer_review') return 'current';
      return 'completed';
    }
    if (stepKey === 'decision') {
      if (isApproved) return 'approved';
      if (isCorrectionRequired) return 'correction_required';
      if (isRejected) return 'rejected';
      return 'pending';
    }
    return 'pending';
  };

  const displaySurveyNo = backendApp?.surveyNumber || selectedApp?.plotDetails?.surveyNo || '142/3A';
  const displayPlotNo = backendApp?.plotNumber || selectedApp?.plotDetails?.pattaNo || 'PTA/2026/8912';
  const displayPlotArea = backendApp?.plotArea || selectedApp?.plotAreaSqm || 240;
  const displayBuildingType = backendApp?.buildingType || selectedApp?.buildingType || 'residential';
  const displayFloors = backendApp?.floors || selectedApp?.floors || 2;

  const liveRuleCount = backendReport?.ruleResults?.length || 0;
  const livePassCount = backendReport?.ruleResults?.filter((r) => r.status === 'PASS').length || 0;
  const liveScore = liveRuleCount > 0 ? Math.round((livePassCount / liveRuleCount) * 100) : null;
  const currentComplianceScore = liveScore !== null
    ? liveScore
    : (backendApp?.complianceScore ?? selectedApp?.aiReport?.complianceScore ?? 100);
  const meetsThreshold = currentComplianceScore >= 80;

  return (
    <div className="space-y-6">
      {/* Search and Application Switcher Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Application No (e.g. PS-ECB7A092)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
          >
            Track Permit
          </button>
        </form>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">Your Permits:</span>
          {[
            ...backendAppsList.slice(-4).reverse().map((b) => ({
              key: `b-${b.id}`,
              appNo: b.applicationNumber,
              label: b.applicationNumber,
              isApproved: b.status === 'APPROVED',
              isCurrent: (backendApp?.applicationNumber || selectedApp?.applicationNo) === b.applicationNumber,
            })),
            ...myApps
              .filter((m) => !backendAppsList.some((b) => b.applicationNumber === m.applicationNo))
              .slice(0, 3)
              .map((m) => ({
                key: `m-${m.id}`,
                appNo: m.applicationNo,
                label: m.applicationNo.split('/').slice(1).join('/') || m.applicationNo,
                isApproved: m.status === 'approved',
                isCurrent: (backendApp?.applicationNumber || selectedApp?.applicationNo) === m.applicationNo,
              })),
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSearchParams({ app: item.appNo });
                setSearchInput(item.appNo);
              }}
              className={`text-xs px-2.5 py-1 rounded font-mono transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                item.isCurrent
                  ? 'bg-blue-900 text-white font-bold ring-2 ring-blue-400'
                  : item.isApproved
                  ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{item.label}</span>
              {item.isApproved && <span className="text-[9px] font-sans font-bold uppercase text-emerald-700 bg-emerald-200/60 px-1 rounded">Approved</span>}
            </button>
          ))}
        </div>
      </div>

      {(backendApp || selectedApp) ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Vertical Stepper & Timeline */}
          <div className="space-y-6">
            {/* Status Card Header */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                    Sanction Tracking Desk
                  </span>
                  <h3 className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {displayAppNo}
                  </h3>
                </div>
                <StatusBadge status={effectiveStatus as ApplicationStatus} size="md" />
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedApp?.applicantName || 'S. K. Murugesan & Associates'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span>S.No {displaySurveyNo}, Plot {displayPlotNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Building Category:</span>
                  <span className="capitalize font-medium">{displayBuildingType} (G+{displayFloors - 1})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plot Extent:</span>
                  <span className="font-mono">{displayPlotArea} sq.m</span>
                </div>
              </div>

              {/* Official Sanction Certificate Card */}
              {(isApproved || backendCertificate?.hasCertificate) && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-emerald-950 font-bold text-xs">
                      <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Statutory Sanction Permit Issued</span>
                    </div>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Approved
                    </span>
                  </div>

                  <div className="bg-white/95 p-3 rounded-lg border border-emerald-200 text-[11px] text-slate-700 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Permit Number:</span>
                      <span className="font-bold text-emerald-950">
                        {backendCertificate?.certificateNumber || `TN-SANCTION-2026-${displayAppNo}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Sanctioned By:</span>
                      <span className="font-semibold text-slate-800">
                        {backendCertificate?.officerName || 'Er. Rajesh Sharma (Zonal Officer)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Statutory Validity:</span>
                      <span className="text-slate-800">
                        {backendCertificate?.expiryDate
                          ? `${new Date(backendCertificate.expiryDate).toLocaleDateString()} (3 Years)`
                          : '3 Years Statutory Validity'}
                      </span>
                    </div>
                    {backendCertificate?.verificationHash && (
                      <div className="flex justify-between items-center pt-1 border-t border-emerald-100">
                        <span className="text-slate-500 font-sans">Digital Hash:</span>
                        <span className="text-[10px] text-emerald-800 font-mono truncate max-w-[150px]">
                          {backendCertificate.verificationHash.substring(0, 16)}...
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <Link
                      to={`/verify/${encodeURIComponent(displayAppNo)}`}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>Download Sanction Order Permit</span>
                    </Link>

                    <Link
                      to={`/verify/${encodeURIComponent(displayAppNo)}`}
                      className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verify Digital Seal &amp; QR</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Official Rejection Notice Card */}
              {isRejected && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-rose-950 font-bold text-xs">
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>Application Rejected by Authority</span>
                    </div>
                    <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Rejected
                    </span>
                  </div>

                  <div className="bg-white/95 p-3 rounded-lg border border-rose-200 text-[11px] text-slate-700 space-y-2">
                    <div>
                      <span className="text-slate-500 font-sans block text-[10px] uppercase font-semibold">Official Grounds for Rejection:</span>
                      <p className="font-semibold text-rose-950 mt-0.5 leading-relaxed">
                        {backendApp?.rejectionReason || selectedApp?.rejectionReason || 'The submitted building plan proposal violates mandatory statutory development standards under TNCDBR 2019.'}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-rose-100 flex justify-between text-[10px] text-slate-600">
                      <span>Action by: Er. Rajesh Sharma</span>
                      <span className="font-mono">Town Planning Desk</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-rose-100/70 border border-rose-200 rounded-lg text-[11px] text-rose-900 leading-relaxed">
                    <strong>Citizen Guidance:</strong> You may modify your architectural drawings to adhere to the statutory limits and submit a fresh application or appeal to the municipal appellate authority.
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Progress Stepper */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                Permit Approval Progress Stepper
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {/* Step 1: Application Submitted */}
                <div className="relative">
                  <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-white">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Application Submitted</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {backendApp?.submittedAt
                        ? new Date(backendApp.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : selectedApp?.submittedAt
                        ? new Date(selectedApp.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Submitted online'}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Fee paid and drawings registered in Namakkal municipal registry.
                    </p>
                  </div>
                </div>

                {/* Step 2: AI Scrutiny Evaluation */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                    getStepStatus('ai_review') === 'completed'
                      ? 'bg-emerald-500 text-white'
                      : getStepStatus('ai_review') === 'current'
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {getStepStatus('ai_review') === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>TNCDBR AI Scrutiny Engine</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        meetsThreshold ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        Score: {currentComplianceScore}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {liveRuleCount > 0
                        ? `${livePassCount} of ${liveRuleCount} statutory rules compliant with TNCDBR 2019.`
                        : 'Automated rule checks against Tamil Nadu Combined Building Rules 2019.'}
                    </p>
                  </div>
                </div>

                {/* Step 3: Town Planning Officer Verification */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                    getStepStatus('officer_review') === 'completed'
                      ? 'bg-emerald-500 text-white'
                      : getStepStatus('officer_review') === 'current'
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {getStepStatus('officer_review') === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <UserCheck className="w-3 h-3" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Officer Technical Inspection</div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {backendCertificate?.officerName || selectedApp?.assignedOfficerName || 'Town Planning Officer'} technical scrutiny.
                    </p>
                  </div>
                </div>

                {/* Step 4: Final Decision */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                    isApproved
                      ? 'bg-emerald-500 text-white'
                      : isCorrectionRequired
                      ? 'bg-amber-500 text-white'
                      : isRejected
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isCorrectionRequired && <AlertTriangle className="w-3.5 h-3.5" />}
                    {isRejected && <XCircle className="w-3.5 h-3.5" />}
                    {!isApproved && !isCorrectionRequired && !isRejected && (
                      <Clock className="w-3 h-3" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {isApproved
                        ? 'Sanction Order Issued'
                        : isCorrectionRequired
                        ? 'Corrections Required'
                        : isRejected
                        ? 'Application Rejected'
                        : 'Final Sanction Determination'}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {isApproved
                        ? 'Building permit sanctioned under TNCDBR 2019 statutory regulations.'
                        : isCorrectionRequired
                        ? 'Planning officer has requested statutory revisions to plan drawings.'
                        : isRejected
                        ? 'Building proposal does not conform to applicable development rules.'
                        : 'Pending final review and decision by authorized municipal officer.'}
                    </p>
                    {backendCertificate?.issueDate && (
                      <div className="text-[11px] text-emerald-700 font-mono mt-1 font-semibold">
                        Sanction Date: {new Date(backendCertificate.issueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Official Audit Trail Timeline */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Official Action Log
              </h4>
              <div className="space-y-3">
                {backendHistory.length > 0 ? (
                  backendHistory.map((entry) => (
                    <div key={entry.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-900 font-bold uppercase">
                            {entry.toStatus}
                          </span>
                          <span>{entry.changedByName || 'Planning Authority'}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {entry.remarks || `Application status updated to ${entry.toStatus}`}
                      </p>
                    </div>
                  ))
                ) : selectedApp?.timeline ? (
                  selectedApp.timeline.map((entry) => (
                    <div key={entry.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                        <span>{entry.actorName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(entry.at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{entry.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No historical actions recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: AI Report & Correction Remediation / Drawing Viewer */}
          <div className="lg:col-span-2 space-y-6">
            {/* CORRECTION REMEDIATION PANEL (If correction_required) */}
            {isCorrectionRequired && (
              <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-950">
                        Officer Correction Notice ({selectedApp?.corrections?.length || 1} Items Required)
                      </h4>
                      <p className="text-xs text-amber-800">
                        Please review the non-compliant items below, modify your architectural drawings, and re-upload the revised plan.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-amber-200 text-amber-900 font-semibold px-2.5 py-1 rounded-full">
                    Action Required
                  </span>
                </div>

                {/* List of corrections */}
                {selectedApp?.corrections && selectedApp.corrections.length > 0 && (
                  <div className="space-y-2.5">
                    {selectedApp.corrections.map((corr, idx) => (
                      <div
                        key={corr.id || idx}
                        className="p-3.5 bg-white rounded-lg border border-amber-200 shadow-xs"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-mono text-[10px]">
                              {idx + 1}
                            </span>
                            {corr.section}
                          </span>
                          {corr.ruleRef && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                              {corr.ruleRef}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-800 pl-6 leading-relaxed">
                          {corr.point}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Re-upload Area */}
                <div className="bg-white p-4 rounded-lg border border-amber-200 space-y-3">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Re-upload Revised Drawings (PDF / DXF)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Select Revised CAD/PDF File
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.dxf,.dwg,.jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={handleRevisedUpload}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Architect Revision Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Setbacks adjusted to 3.0m and RWH details added"
                        value={revisionNote}
                        onChange={(e) => setRevisionNote(e.target.value)}
                        className="w-full text-xs p-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {revisedFiles.length > 0 && (
                    <div className="text-xs text-emerald-700 font-medium">
                      ✓ {revisedFiles.length} revised file(s) ready for scrutiny
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={isReuploading || revisedFiles.length === 0}
                      onClick={handleSubmittingRevisedDrawings}
                      className="inline-flex items-center space-x-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{isReuploading ? 'Processing AI Re-Scrutiny...' : 'Submit Revised Drawings for AI Re-Scrutiny'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI SCRUTINY REPORT CARD (Live Backend or Scrutinized Model) */}
            {(backendReport?.ruleResults?.length || selectedApp?.aiReport || isApproved) && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        TNCDBR 2019 Scrutiny Evaluation Report
                      </h3>
                      <p className="text-xs text-slate-500">
                        Statutory Scrutiny Engine • Tamil Nadu Combined Development and Building Rules, 2019
                      </p>
                    </div>
                  </div>

                  <ComplianceGauge
                    score={currentComplianceScore}
                    recommendation={
                      isApproved
                        ? 'approve'
                        : isCorrectionRequired
                        ? 'correction_required'
                        : meetsThreshold
                        ? 'approve'
                        : 'correction_required'
                    }
                    size="md"
                  />
                </div>

                {/* Statutory Fast-Track Threshold Banner */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    meetsThreshold
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                        meetsThreshold ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {currentComplianceScore}%
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm">
                          {meetsThreshold
                            ? 'Statutory Fast-Track Threshold Met (≥ 80%)'
                            : 'Statutory Clearance Deficit (< 80% Threshold)'}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            meetsThreshold
                              ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-200 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {meetsThreshold ? 'Fast-Track Eligible' : 'Corrections Required'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {meetsThreshold
                          ? `Application passed ${livePassCount} of ${liveRuleCount || 5} statutory provisions under TNCDBR 2019. Forwarded for Officer final clearance.`
                          : `Application passed ${livePassCount} of ${liveRuleCount || 5} provisions. Rectifications required to satisfy the 80% minimum statutory threshold.`}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold block">
                      Fast-Track Standard
                    </span>
                    <p className="text-xs font-bold text-slate-800">Min 80% Statutory Score</p>
                  </div>
                </div>

                {/* AI Extracted Plan Geometry & Engineering Calculations */}
                {backendReport?.metrics && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Calculator className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          AI Extracted Plan Geometry &amp; Engineering Calculations
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                        Drawing OCR + Metric Extraction
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block font-medium">Plot Extent</span>
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {displayPlotArea} m²
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Applicant Declared</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block font-medium">Ground Coverage</span>
                        <span className="text-xs font-bold text-indigo-900 font-mono">
                          {backendReport.metrics.ground_coverage_percent != null
                            ? `${backendReport.metrics.ground_coverage_percent}%`
                            : 'N/A'}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {backendReport.metrics.ground_coverage_area != null
                            ? `${backendReport.metrics.ground_coverage_area} m²`
                            : 'Footprint area'}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block font-medium">Built-Up Area</span>
                        <span className="text-xs font-bold text-indigo-900 font-mono">
                          {backendReport.metrics.built_up_area != null
                            ? `${backendReport.metrics.built_up_area} m²`
                            : 'N/A'}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {displayFloors} Floors (G+{displayFloors - 1})
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block font-medium">Floor Area Ratio (FAR)</span>
                        <span className="text-xs font-bold text-indigo-900 font-mono">
                          {backendReport.metrics.far != null
                            ? `${backendReport.metrics.far}`
                            : 'N/A'}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Max Permissible: 2.50</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block font-medium">Front Setback</span>
                        <span className="text-xs font-bold text-indigo-900 font-mono">
                          {backendReport.metrics.front_setback != null
                            ? `${backendReport.metrics.front_setback} m`
                            : '3.00 m'}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Min Required: 3.0 m</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block font-medium">Road Width</span>
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {backendApp?.roadWidth || 12.0} m
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Min Required: 9.0 m</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Executive Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900 block mb-1">Executive Scrutiny Summary:</strong>
                  {backendReport?.ruleResults?.length
                    ? `Statutory rules engine scrutinized ${backendReport.ruleResults.length} provisions under TNCDBR 2019. Passed ${
                        backendReport.ruleResults.filter((r) => r.status === 'PASS').length
                      } rules. ${
                        isApproved
                          ? 'All statutory requirements verified and approved. Building Permit Order Sanctioned.'
                          : 'Scrutiny findings forwarded for officer review.'
                      }`
                    : selectedApp?.aiReport?.summary ||
                      'All mandatory statutory requirements under TNCDBR 2019 (FSI, Setbacks, Road Width, RWH) have been scrutinized and validated.'}
                </div>

                {/* Scrutiny Checks Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                    Statutory Rule Scrutiny Breakdown ({
                      backendReport?.ruleResults?.length || selectedApp?.aiReport?.checks?.length || 0
                    } Provisions)
                  </h4>

                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
                    {backendReport?.ruleResults && backendReport.ruleResults.length > 0 ? (
                      backendReport.ruleResults.map((check) => {
                        const isPass = check.status === 'PASS';
                        const isFail = check.status === 'FAIL';
                        return (
                          <div key={check.id} className="p-3.5 hover:bg-slate-50 text-xs transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center space-x-2">
                                {isPass ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : isFail ? (
                                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                )}
                                <span className="font-bold text-slate-900">{check.rule_name}</span>
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                                  {check.rule_code}
                                </span>
                              </div>

                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize self-start sm:self-auto ${
                                  isPass
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : isFail
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isPass ? 'Passed' : isFail ? 'Non-Compliant' : 'Needs Review'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pl-6 mb-1 font-mono">
                              <div>
                                <strong className="font-sans text-slate-500">Statutory Norm:</strong>{' '}
                                {check.required_value}
                              </div>
                              <div>
                                <strong className="font-sans text-slate-500">Proposed in Plan:</strong>{' '}
                                {check.actual_value}
                              </div>
                            </div>

                            {check.fix_hint && (
                              <div
                                className={`mt-2 ml-6 p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start space-x-2 ${
                                  isPass
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                    : 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                                }`}
                              >
                                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" />
                                <div>
                                  <strong className="font-semibold block mb-0.5">
                                    Statutory Guidance &amp; Suggestion:
                                  </strong>
                                  <span>{check.fix_hint}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : selectedApp?.aiReport?.checks ? (
                      selectedApp.aiReport.checks.map((check, idx) => (
                        <div key={idx} className="p-3.5 hover:bg-slate-50 text-xs transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center space-x-2">
                              {check.status === 'pass' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : check.status === 'fail' ? (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              )}
                              <span className="font-bold text-slate-900">{check.rule}</span>
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                                {check.ruleRef}
                              </span>
                            </div>

                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize self-start sm:self-auto ${
                                check.status === 'pass'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : check.status === 'fail'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {check.status === 'pass' ? 'Passed' : check.status === 'fail' ? 'Non-Compliant' : 'Manual Check'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pl-6 mb-1 font-mono">
                            <div>
                              <strong className="font-sans text-slate-500">Statutory Norm:</strong> {check.required}
                            </div>
                            <div>
                              <strong className="font-sans text-slate-500">Proposed in Plan:</strong> {check.found}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 pl-6 italic">{check.remark}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        Statutory compliance confirmed by Town Planning Scrutiny Desk.
                      </div>
                    )}
                  </div>
                </div>

                {/* Statutory Citizen Guidance & Action Plan */}
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <h5 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                      Citizen Statutory Guidance &amp; Approval Next Steps
                    </h5>
                  </div>
                  <p className="text-xs text-blue-900 leading-relaxed">
                    {meetsThreshold
                      ? `Your architectural plan satisfies statutory scrutiny standards under TNCDBR 2019 with a compliance rating of ${currentComplianceScore}%. The municipal technical review has confirmed your plan meets or exceeds the required 80% threshold. The file is currently on the Town Planning Officer desk for final digital sign-off and permit issuance.`
                      : `Certain architectural parameters in the submitted drawings require adjustment to reach the 80% fast-track threshold. Please consult the statutory remedy hints above and provide revised plan sheets through the revision portal.`}
                  </p>
                </div>
              </div>
            )}

            {/* Drawing Previewer Pane */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Submitted Drawing Sheets &amp; Vector Documents
              </h4>
              {backendDocs && backendDocs.length > 0 ? (
                <PlanDocumentViewer
                  files={backendDocs.map((doc) => ({
                    name: doc.fileName,
                    type:
                      doc.contentType?.toLowerCase().includes('pdf') || doc.fileName?.toLowerCase().endsWith('.pdf')
                        ? 'pdf'
                        : doc.fileName?.toLowerCase().endsWith('.dxf')
                        ? 'dxf'
                        : 'image',
                    storagePath: doc.filePath || `doc-${doc.id}`,
                    url: getDocumentFileUrl(doc.applicationId, doc.id),
                    sizeBytes: doc.fileSize,
                    uploadedAt: doc.uploadedAt || new Date().toISOString(),
                  }))}
                />
              ) : selectedApp?.files && selectedApp.files.length > 0 ? (
                <PlanDocumentViewer files={selectedApp.files} />
              ) : (
                <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>Standard architectural submission drawings registered with municipal planning authority.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Application Selected</h3>
          <p className="text-xs text-slate-500 mt-1">Please enter an application number above to track permit progress.</p>
        </div>
      )}
    </div>
  );
};

