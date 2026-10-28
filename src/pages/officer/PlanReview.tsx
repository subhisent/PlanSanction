import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApplications } from '../../services/store';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ComplianceGauge } from '../../components/common/ComplianceGauge';
import { PlanDocumentViewer } from '../../components/common/PlanDocumentViewer';
import type { UploadedPlanFile } from '../../types';

import {
  fetchApplicationById,
  fetchApplications,
  approveBackendApplication,
  requestBackendCorrections,
  rejectBackendApplication,
  fetchRoomDimensions,
  fetchApplicationDocuments,
  fetchVerifiedMeasurementsForDocument,
  saveVerifiedMeasurement,
  saveBatchVerifiedMeasurements,
  fetchScrutinyReport,
  getDocumentFileUrl,
  type BackendApplication,
  type BackendApplicationDocument,
  type RoomDimensionCandidate,
  type VerifiedMeasurement,
  type SaveVerifiedMeasurementRequest,
  type BackendScrutinyReport,
} from '../../services/applicationApi';

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Sparkles,
  Plus,
  Trash2,
  ArrowLeft,
  FileCheck2,
  Loader2,
  Check,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const PlanReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // Backend state
  const [backendApp, setBackendApp] = useState<BackendApplication | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(true);
  const [applicationError, setApplicationError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // In-app Confirmation Modal State
  const [activeModal, setActiveModal] = useState<{
    type: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'CORRECTIONS' | 'REJECT';
    title: string;
    subtitle: string;
    confirmText: string;
    confirmBgClass: string;
  } | null>(null);

  // Documents
  const [backendDocuments, setBackendDocuments] = useState<BackendApplicationDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  // OCR Room Dimensions Candidates
  const [roomDimensions, setRoomDimensions] = useState<RoomDimensionCandidate[]>([]);
  const [roomDimensionsLoading, setRoomDimensionsLoading] = useState(false);
  const [roomDimensionsError, setRoomDimensionsError] = useState('');

  // Verified Measurements
  const [savedMeasurements, setSavedMeasurements] = useState<VerifiedMeasurement[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);

  // Active candidate being reviewed/verified
  const [activeCandidate, setActiveCandidate] = useState<RoomDimensionCandidate | null>(null);
  const [measurementType, setMeasurementType] = useState('ROOM_DIMENSIONS');
  const [verifiedVal1, setVerifiedVal1] = useState('');
  const [verifiedVal2, setVerifiedVal2] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<'m' | 'ft' | 'mm' | 'cm' | 'in'>('m');
  const [verificationStatus, setVerificationStatus] = useState<'VERIFIED' | 'CORRECTED'>('VERIFIED');
  const [officerRemarks, setOfficerRemarks] = useState('');
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [isBatchVerifying, setIsBatchVerifying] = useState(false);
  const [measurementMessage, setMeasurementMessage] = useState<string | null>(null);
  const [measurementError, setMeasurementError] = useState<string | null>(null);

  // Scrutiny Report
  const [backendReport, setBackendReport] = useState<BackendScrutinyReport | null>(null);

  // In-memory demo fallback (if applicable)
  const { applications } = useApplications();
  const demoApp = applications.find(
    (application) => application.id === id || application.applicationNo === id
  );
  const app = demoApp;

  const [activeTab, setActiveTab] = useState<'ai_report' | 'actions' | 'drawing_meta'>('ai_report');

  const initialCorrections =
    app?.aiReport?.correctionPoints?.map((correction, index) => ({
      id: `cp-${index + 1}`,
      point: correction.point,
      section: correction.section,
      ruleRef: correction.ruleRef || 'TNCDBR 2019',
    })) || [
      {
        id: 'cp-1',
        point: 'Review the required front setback against the applicable rules.',
        section: 'Setbacks & Open Spaces',
        ruleRef: 'TNCDBR 2019 - verify applicable provision',
      },
    ];

  const [editableCorrections, setEditableCorrections] = useState(initialCorrections);
  const [newCorrectionPoint, setNewCorrectionPoint] = useState('');
  const [newCorrectionSection, setNewCorrectionSection] = useState('Setbacks & Open Spaces');

  const [conditions, setConditions] = useState<string[]>([
    'Rainwater harvesting provisions must comply with applicable requirements.',
    'Required setback spaces must remain free of prohibited encroachments.',
    'Required access and fire-safety provisions must be maintained where applicable.',
  ]);

  const [newCondition, setNewCondition] = useState('');
  const [rejectionReason, setRejectionReason] = useState(
    'Non-conformance with the applicable building approval requirements.'
  );

  // 1. Load application by ID or applicationNumber
  useEffect(() => {
    let cancelled = false;

    const loadApplication = async () => {
      if (!id) {
        setApplicationError('Application ID is missing.');
        setBackendApp(null);
        setLoadingApplication(false);
        return;
      }

      setLoadingApplication(true);
      setApplicationError('');

      try {
        let selected: BackendApplication | null = null;
        if (/^\d+$/.test(id)) {
          selected = await fetchApplicationById(Number(id));
        } else {
          const items = await fetchApplications();
          selected =
            items.find((item) => String(item.id) === id || item.applicationNumber === id) || null;
        }

        if (cancelled) return;

        if (!selected) {
          setBackendApp(null);
          setApplicationError(`Application #${id} was not found in the backend.`);
          return;
        }

        setBackendApp(selected);
      } catch (error) {
        if (cancelled) return;

        setBackendApp(null);
        setApplicationError(
          error instanceof Error ? error.message : 'Unable to load application from backend.'
        );
      } finally {
        if (!cancelled) {
          setLoadingApplication(false);
        }
      }
    };

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // 2. Load uploaded documents for this application
  useEffect(() => {
    if (!backendApp?.id) return;

    let cancelled = false;

    async function loadDocuments() {
      setDocumentsLoading(true);
      setDocumentsError(null);

      try {
        const documents = await fetchApplicationDocuments(backendApp!.id);

        if (cancelled) return;

        setBackendDocuments(documents);

        if (documents.length > 0) {
          setSelectedDocumentId(documents[0].id);
        } else {
          setSelectedDocumentId(null);
        }
      } catch (error) {
        if (!cancelled) {
          setDocumentsError(
            error instanceof Error ? error.message : 'Failed to load application documents.'
          );
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [backendApp?.id]);

  // 3. Load Room Dimensions candidates and Verified Measurements when selectedDocumentId changes
  useEffect(() => {
    if (selectedDocumentId === null) {
      setRoomDimensions([]);
      setSavedMeasurements([]);
      return;
    }

    let cancelled = false;

    async function loadDocumentData() {
      setRoomDimensionsLoading(true);
      setRoomDimensionsError('');

      try {
        const result = await fetchRoomDimensions(selectedDocumentId!);
        if (!cancelled) {
          setRoomDimensions(result.roomDimensionCandidates ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setRoomDimensionsError(
            error instanceof Error ? error.message : 'Failed to load extracted dimensions.'
          );
        }
      } finally {
        if (!cancelled) {
          setRoomDimensionsLoading(false);
        }
      }

      setLoadingMeasurements(true);
      try {
        const measurements = await fetchVerifiedMeasurementsForDocument(selectedDocumentId!);
        if (!cancelled) {
          setSavedMeasurements(measurements);
        }
      } catch (err) {
        console.error('Failed to load saved measurements:', err);
      } finally {
        if (!cancelled) {
          setLoadingMeasurements(false);
        }
      }
    }

    void loadDocumentData();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId]);

  // 4. Load Technical Scrutiny Report when application changes
  useEffect(() => {
    if (!backendApp?.id) {
      setBackendReport(null);
      return;
    }

    let cancelled = false;

    async function loadReport() {
      try {
        const report = await fetchScrutinyReport(backendApp!.id);
        if (!cancelled) {
          setBackendReport(report);
        }
      } catch (err) {
        console.error('Failed to load scrutiny report:', err);
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [backendApp?.id]);

  // Helper to identify room name, icon, and standardized measurement type
  const getRoomDetails = (candidate: RoomDimensionCandidate, index: number) => {
    const line = (candidate.line_text || '').toLowerCase();
    const source = (candidate.source_text || '').toLowerCase();
    const roomName = (candidate.room_name || '').toLowerCase();
    const combined = `${roomName} ${line} ${source}`;

    let name = candidate.room_name || '';
    let type = 'ROOM_DIMENSIONS';
    let icon = '🏠';

    if (/master\s+bed|bed\s*room|bedroom|\bbed\b/.test(combined)) {
      name = candidate.room_name || 'Bedroom';
      type = 'BEDROOM_DIMENSIONS';
      icon = '🛏️';
    } else if (/kitchen|modular\s+kitchen|\bkit\b/.test(combined)) {
      name = candidate.room_name || 'Kitchen';
      type = 'KITCHEN_DIMENSIONS';
      icon = '🍳';
    } else if (/living\s+room|living|\bhall\b|drawing/.test(combined)) {
      name = candidate.room_name || 'Living Room';
      type = 'LIVING_ROOM_DIMENSIONS';
      icon = '🛋️';
    } else if (/dining|dinning/.test(combined)) {
      name = candidate.room_name || 'Dining Room';
      type = 'DINING_ROOM_DIMENSIONS';
      icon = '🍽️';
    } else if (/toilet|bath|washroom|\bwc\b|c\.?\s*toilet/.test(combined)) {
      name = candidate.room_name || 'Toilet / Washroom';
      type = 'TOILET_DIMENSIONS';
      icon = '🚿';
    } else if (/pooja|puja|prayer/.test(combined)) {
      name = candidate.room_name || 'Puja Room';
      type = 'PUJA_ROOM_DIMENSIONS';
      icon = '🪔';
    } else if (/balcony|verandah|terrace|sit\s*out|sitout/.test(combined)) {
      name = candidate.room_name || 'Balcony / Verandah';
      type = 'BALCONY_DIMENSIONS';
      icon = '🌿';
    } else if (/stair|staircase/.test(combined)) {
      name = candidate.room_name || 'Staircase';
      type = 'STAIRCASE_DIMENSIONS';
      icon = '🪜';
    } else if (/parking|garage|portico/.test(combined)) {
      name = candidate.room_name || 'Parking / Portico';
      type = 'PARKING_DIMENSIONS';
      icon = '🚗';
    } else if (candidate.room_name) {
      name = candidate.room_name;
      type = 'ROOM_DIMENSIONS';
      icon = '🏠';
    } else {
      const standardSequence = [
        { name: 'Bedroom', type: 'BEDROOM_DIMENSIONS', icon: '🛏️' },
        { name: 'Living Room', type: 'LIVING_ROOM_DIMENSIONS', icon: '🛋️' },
        { name: 'Kitchen', type: 'KITCHEN_DIMENSIONS', icon: '🍳' },
        { name: 'Dining Room', type: 'DINING_ROOM_DIMENSIONS', icon: '🍽️' },
        { name: 'Toilet / Washroom', type: 'TOILET_DIMENSIONS', icon: '🚿' },
        { name: 'Balcony / Verandah', type: 'BALCONY_DIMENSIONS', icon: '🌿' },
        { name: 'Puja Room', type: 'PUJA_ROOM_DIMENSIONS', icon: '🪔' },
      ];
      const item = standardSequence[index % standardSequence.length];
      name = item.name;
      type = item.type;
      icon = item.icon;
    }

    // Preserve exact blueprint values from citizen uploaded document - never clamp or override
    const cleanVal1 = candidate.first_dimension;
    const cleanVal2 = candidate.second_dimension ?? cleanVal1;

    return { name, type, icon, cleanVal1, cleanVal2 };
  };

  // Helper to format calculated area considering unit (cm, m, ft, mm, in)
  const formatCalculatedArea = (val1: number, val2: number, unit?: string | null) => {
    const raw = val1 * val2;
    const u = (unit || 'm').toLowerCase();
    if (u === 'cm') {
      const sqM = raw / 10000;
      const sqFt = sqM * 10.7639;
      return `${sqM.toFixed(2)} sq.m (${sqFt.toFixed(2)} sq.ft)`;
    } else if (u === 'mm') {
      const sqM = raw / 1000000;
      const sqFt = sqM * 10.7639;
      return `${sqM.toFixed(2)} sq.m (${sqFt.toFixed(2)} sq.ft)`;
    } else if (u === 'ft') {
      const sqFt = raw;
      const sqM = sqFt * 0.092903;
      return `${sqFt.toFixed(2)} sq.ft (${sqM.toFixed(2)} sq.m)`;
    } else if (u === 'in') {
      const sqFt = raw / 144;
      const sqM = sqFt * 0.092903;
      return `${sqFt.toFixed(2)} sq.ft (${sqM.toFixed(2)} sq.m)`;
    } else {
      const sqM = raw;
      const sqFt = sqM * 10.7639;
      return `${sqM.toFixed(2)} sq.m (${sqFt.toFixed(2)} sq.ft)`;
    }
  };

  // Single common batch verify handler
  const handleVerifyAllMeasurements = async () => {
    if (!backendApp || !selectedDocumentId) {
      setMeasurementError('No application or document selected.');
      return;
    }

    if (roomDimensions.length === 0) {
      setMeasurementError('No room dimension candidates detected to verify.');
      return;
    }

    setIsBatchVerifying(true);
    setMeasurementError(null);
    setMeasurementMessage(null);

    try {
      const requests: SaveVerifiedMeasurementRequest[] = roomDimensions.map((cand, idx) => {
        const room = getRoomDetails(cand, idx);
        const unitVal: 'm' | 'ft' | 'mm' | 'cm' | 'in' =
          cand.unit === 'm' || cand.unit === 'ft' || cand.unit === 'mm' || cand.unit === 'cm' || cand.unit === 'in'
            ? cand.unit
            : (room.cleanVal1 >= 50 ? 'cm' : 'm');

        return {
          applicationId: backendApp.id,
          documentId: selectedDocumentId,
          extractedDataId: null,
          measurementType: room.type,
          originalValue1: cand.first_dimension ?? null,
          originalValue2: cand.second_dimension ?? null,
          verifiedValue1: room.cleanVal1,
          verifiedValue2: room.cleanVal2,
          unit: unitVal,
          verificationStatus: 'VERIFIED',
          officerId: 2,
          officerRemarks: `Officer verified ${room.name} dimensions (${room.cleanVal1} x ${room.cleanVal2} ${unitVal}) against plan drawing page ${cand.source_page || 1}`,
        };
      });

      const savedList = await saveBatchVerifiedMeasurements(requests);

      // Refresh measurements and report from MySQL
      const refreshed = await fetchVerifiedMeasurementsForDocument(selectedDocumentId);
      setSavedMeasurements(refreshed);

      const updatedReport = await fetchScrutinyReport(backendApp.id);
      setBackendReport(updatedReport);

      setMeasurementMessage(
        `✓ All ${savedList.length} room dimensions verified and successfully saved to MySQL database.`
      );
      setActiveCandidate(null);

      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.5 },
        });
      } catch {}
    } catch (err) {
      setMeasurementError(
        err instanceof Error ? err.message : 'Failed to batch verify measurements.'
      );
    } finally {
      setIsBatchVerifying(false);
    }
  };

  // Select a candidate for officer verification/correction
  const handleSelectCandidate = (candidate: RoomDimensionCandidate, index: number) => {
    setActiveCandidate(candidate);
    const room = getRoomDetails(candidate, index);
    setVerifiedVal1(String(room.cleanVal1));
    setVerifiedVal2(String(room.cleanVal2));
    setSelectedUnit(
      candidate.unit === 'm' ||
        candidate.unit === 'ft' ||
        candidate.unit === 'mm' ||
        candidate.unit === 'cm' ||
        candidate.unit === 'in'
        ? candidate.unit
        : 'm'
    );
    setMeasurementType(room.type);
    setVerificationStatus('VERIFIED');
    setOfficerRemarks(`Verified ${room.name} dimensions from drawing page ${candidate.source_page}`);
    setMeasurementMessage(null);
    setMeasurementError(null);
  };

  // Save verified measurement to MySQL
  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendApp || !selectedDocumentId) {
      setMeasurementError('No application or document selected.');
      return;
    }

    const val1 = parseFloat(verifiedVal1);
    const val2 = verifiedVal2.trim() ? parseFloat(verifiedVal2) : null;

    if (isNaN(val1) || val1 <= 0) {
      setMeasurementError('Please enter a valid, positive first measurement.');
      return;
    }

    if (val2 !== null && (isNaN(val2) || val2 <= 0)) {
      setMeasurementError('Please enter a valid, positive second measurement.');
      return;
    }

    setIsSavingMeasurement(true);
    setMeasurementError(null);
    setMeasurementMessage(null);

    try {
      const payload: SaveVerifiedMeasurementRequest = {
        applicationId: backendApp.id,
        documentId: selectedDocumentId,
        extractedDataId: null,
        measurementType,
        originalValue1: activeCandidate?.first_dimension ?? null,
        originalValue2: activeCandidate?.second_dimension ?? null,
        verifiedValue1: val1,
        verifiedValue2: val2,
        unit: selectedUnit,
        verificationStatus,
        officerId: 2, // Authorized municipal officer
        officerRemarks:
          officerRemarks.trim() ||
          `Officer verified against plan drawing page ${activeCandidate?.source_page || 1}`,
      };

      const saved = await saveVerifiedMeasurement(payload);

      // Refresh saved measurements
      const refreshed = await fetchVerifiedMeasurementsForDocument(selectedDocumentId);
      setSavedMeasurements(refreshed);

      // Refresh scrutiny report
      const updatedReport = await fetchScrutinyReport(backendApp.id);
      setBackendReport(updatedReport);

      setMeasurementMessage(
        `Measurement #${saved.id} (${measurementType}) confirmed and saved to MySQL.`
      );
      setActiveCandidate(null);
    } catch (err) {
      setMeasurementError(err instanceof Error ? err.message : 'Failed to save measurement.');
    } finally {
      setIsSavingMeasurement(false);
    }
  };

  // Open modal handlers
  const openApproveModal = (withConditions: boolean) => {
    setActionError(null);
    if (!backendApp) {
      setActionError('Backend application is not loaded yet.');
      return;
    }
    setActiveModal(
      withConditions
        ? {
            type: 'APPROVE_WITH_CONDITIONS',
            title: 'Approve with Standard Conditions',
            subtitle: `Grant statutory sanction to ${backendApp.applicationNumber} subject to municipal compliance conditions.`,
            confirmText: 'Confirm Approval with Conditions',
            confirmBgClass: 'bg-blue-700 hover:bg-blue-800',
          }
        : {
            type: 'APPROVE',
            title: 'Approve & Issue Sanction Order',
            subtitle: `Grant full statutory sanction to ${backendApp.applicationNumber} under TNCDBR 2019. An official verifiable permit certificate will be generated immediately.`,
            confirmText: 'Confirm & Issue Sanction Order',
            confirmBgClass: 'bg-emerald-600 hover:bg-emerald-700',
          }
    );
  };

  const openCorrectionsModal = () => {
    setActionError(null);
    if (!backendApp) {
      setActionError('Backend application is not loaded yet.');
      return;
    }
    setActiveModal({
      type: 'CORRECTIONS',
      title: 'Issue Statutory Correction Notice',
      subtitle: `Issue formal notice for ${editableCorrections.length} correction item(s) to ${backendApp.applicationNumber}. Application status will transition to CORRECTIONS_REQUIRED.`,
      confirmText: 'Issue Correction Notice to Applicant',
      confirmBgClass: 'bg-amber-600 hover:bg-amber-700',
    });
  };

  const openRejectModal = () => {
    setActionError(null);
    if (!backendApp) {
      setActionError('Backend application is not loaded yet.');
      return;
    }
    setActiveModal({
      type: 'REJECT',
      title: 'Reject Building Permit Application',
      subtitle: `Formally reject application ${backendApp.applicationNumber} in the Tamil Nadu Municipal Registry under TNCDBR 2019 statutory rules.`,
      confirmText: 'Confirm Proposal Rejection',
      confirmBgClass: 'bg-rose-600 hover:bg-rose-700',
    });
  };

  // Execute confirmed modal action
  const handleConfirmModalAction = async () => {
    if (!backendApp || !activeModal) return;

    setIsProcessing(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      if (activeModal.type === 'APPROVE') {
        const remarks = 'Application approved by authorized municipal officer.';
        const updated = await approveBackendApplication(backendApp.id, remarks);
        setBackendApp(updated);
        setSuccessMessage(`${updated.applicationNumber} approved successfully. Sanction order issued.`);
        setActiveModal(null);
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {
          // Decorative
        }
      } else if (activeModal.type === 'APPROVE_WITH_CONDITIONS') {
        const remarks = `Approved with conditions:\n${conditions.join('\n')}`;
        const updated = await approveBackendApplication(backendApp.id, remarks);
        setBackendApp(updated);
        setSuccessMessage(`${updated.applicationNumber} approved with conditions successfully.`);
        setActiveModal(null);
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {
          // Decorative
        }
      } else if (activeModal.type === 'CORRECTIONS') {
        const remarksList = editableCorrections
          .map((c, i) => `${i + 1}. [${c.section}] ${c.point} (Ref: ${c.ruleRef})`)
          .join('\n');
        const updated = await requestBackendCorrections(
          backendApp.id,
          remarksList || 'Plan requires statutory corrections before sanction.'
        );
        setBackendApp(updated);
        setSuccessMessage(`Correction notice issued for ${updated.applicationNumber}. Status set to CORRECTIONS_REQUIRED.`);
        setActiveModal(null);
      } else if (activeModal.type === 'REJECT') {
        if (!rejectionReason.trim()) {
          setActionError('Please specify a statutory ground/reason for rejection.');
          setIsProcessing(false);
          return;
        }
        const updated = await rejectBackendApplication(backendApp.id, rejectionReason.trim());
        setBackendApp(updated);
        setSuccessMessage(`${updated.applicationNumber} rejected in the municipal registry.`);
        setActiveModal(null);
      }
    } catch (error) {
      console.error('Officer action failed:', error);
      setActionError(
        error instanceof Error ? error.message : 'Failed to execute officer decision.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCondition = () => {
    if (!newCondition.trim()) return;
    setConditions((prev) => [...prev, newCondition.trim()]);
    setNewCondition('');
  };

  const handleRemoveCondition = (idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddCorrection = () => {
    if (!newCorrectionPoint.trim()) return;
    setEditableCorrections((prev) => [
      ...prev,
      {
        id: `cp-${Date.now()}`,
        point: newCorrectionPoint.trim(),
        section: newCorrectionSection,
        ruleRef: 'TNCDBR 2019 - Officer Discretion',
      },
    ]);
    setNewCorrectionPoint('');
  };

  const handleRemoveCorrection = (idToRemove: string) => {
    setEditableCorrections((prev) => prev.filter((c) => c.id !== idToRemove));
  };

  // Convert backend documents into viewer file descriptors
  const viewerFiles: UploadedPlanFile[] =
    backendDocuments.length > 0 && backendApp
      ? backendDocuments.map((doc) => {
          const ext = doc.fileName.split('.').pop()?.toLowerCase();
          const fileType: 'pdf' | 'dwg' | 'dxf' | 'image' =
            ext === 'pdf' ? 'pdf' : ext === 'dxf' ? 'dxf' : ext === 'dwg' ? 'dwg' : 'image';
          return {
            name: doc.fileName,
            type: fileType,
            storagePath: doc.filePath,
            sizeBytes: doc.fileSize,
            url: getDocumentFileUrl(backendApp.id, doc.id),
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          };
        })
      : app?.files || [];

  // Loading state
  if (loadingApplication) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-10 h-10 text-blue-600 mx-auto mb-3 animate-spin" />
        <h3 className="text-base font-bold text-slate-900">Loading Application</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving application details from MySQL...</p>
      </div>
    );
  }

  // Not found state
  if (applicationError && !backendApp && !app) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-900">Application Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">{applicationError}</p>
        <Link
          to="/officer/applications"
          className="mt-4 inline-flex items-center space-x-1 text-xs text-blue-700 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Applications Queue</span>
        </Link>
      </div>
    );
  }

  // Effective display data combining backend and fallback demo metadata
  const effectiveAppNumber = backendApp?.applicationNumber || app?.applicationNo || id || 'PS-APP';
  const effectiveStatus = (backendApp?.status?.toLowerCase() || app?.status || 'submitted') as any;
  const effectiveBuildingType = backendApp?.buildingType || app?.buildingType || 'Low-Rise Residential';
  const effectiveApplicantName = app?.applicantName || 'Citizen Applicant';
  const effectiveSurveyNo = backendApp?.surveyNumber || app?.plotDetails?.surveyNo || 'Survey Plot';
  const effectiveTaluk = app?.plotDetails?.taluk || 'Namakkal';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/officer/applications"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Back to queue"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-slate-900 text-base">
                {effectiveAppNumber}
              </span>
              <StatusBadge status={effectiveStatus} size="sm" />
              <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {effectiveBuildingType}
              </span>
            </div>

            <div className="text-xs text-slate-500 mt-0.5">
              Applicant: <strong className="text-slate-800">{effectiveApplicantName}</strong> •
              S.No. {effectiveSurveyNo}, {effectiveTaluk} Taluk
            </div>
          </div>
        </div>

        {effectiveStatus === 'approved' && (
          <Link
            to={`/verify/${encodeURIComponent(effectiveAppNumber)}`}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>View Sanction Permit (QR)</span>
          </Link>
        )}
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Document Version Selector (if multiple documents) */}
      {backendDocuments.length > 1 && (
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Drawing Versions:</span>
          {backendDocuments.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDocumentId(doc.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedDocumentId === doc.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {doc.fileName} (v{doc.version})
            </button>
          ))}
        </div>
      )}

      {/* Main split-screen layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left column: Plan document viewer */}
        <div className="lg:col-span-7 h-[740px] flex flex-col">
          <PlanDocumentViewer files={viewerFiles} />
        </div>

        {/* Right column: Scrutiny and Decision Desk */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[740px] overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                TNCDBR Scrutiny &amp; Decision Desk
              </h3>
            </div>

            {backendReport?.ruleResults && backendReport.ruleResults.length > 0 ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-700 text-blue-100 rounded">
                {backendReport.ruleResults.filter((r) => r.status === 'PASS').length} Pass /{' '}
                {backendReport.ruleResults.filter((r) => r.status === 'NEEDS_REVIEW').length} Review
              </span>
            ) : app?.aiReport ? (
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-600 rounded">
                Score: {app.aiReport.complianceScore}%
              </span>
            ) : null}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('ai_report')}
              className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                activeTab === 'ai_report'
                  ? 'border-blue-700 text-blue-900 bg-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              AI Scrutiny &amp; Verification
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('actions')}
              className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                activeTab === 'actions'
                  ? 'border-blue-700 text-blue-900 bg-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Officer Action Desk
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('drawing_meta')}
              className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                activeTab === 'drawing_meta'
                  ? 'border-blue-700 text-blue-900 bg-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Site Specs
            </button>
          </div>

          {/* Tab 1: AI Scrutiny and Verification Form */}
          {activeTab === 'ai_report' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Statutory Legal Disclaimer Notice */}
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Legal Notice:</strong> AI scrutiny is a preliminary technical assistance
                  tool. Official statutory sanction requires verification and authorization by the
                  designated municipal officer under the Tamil Nadu Combined Development and
                  Building Rules, 2019.
                </span>
              </div>

              {/* SECTION: OCR Extracted Candidate Dimensions */}
              <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>OCR Extracted Dimension Candidates</span>
                      <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                        {roomDimensions.length} detected
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Provisional room dimensions identified from the blueprint. Verify all with one click or inspect individually.
                    </p>
                  </div>

                  {/* Single Common Verify Button */}
                  {roomDimensions.length > 0 && (
                    <button
                      type="button"
                      id="btn-verify-all-measurements"
                      disabled={isBatchVerifying || roomDimensionsLoading}
                      onClick={handleVerifyAllMeasurements}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 shrink-0"
                    >
                      {isBatchVerifying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to MySQL...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Verify All &amp; Save to MySQL</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {roomDimensionsLoading && (
                  <div className="flex items-center space-x-2 text-xs text-slate-600 py-3 bg-white p-3 rounded-lg border border-amber-200">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                    <span>Extracting architectural room dimensions from plan drawing...</span>
                  </div>
                )}

                {roomDimensionsError && (
                  <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {roomDimensionsError}
                  </p>
                )}

                {!roomDimensionsLoading && !roomDimensionsError && roomDimensions.length === 0 && (
                  <p className="text-xs text-slate-600 italic bg-white p-3 rounded-lg border border-amber-200">
                    No dimension candidates were extracted from this drawing page. You can add verified measurements manually.
                  </p>
                )}

                {/* Candidate list with Room Names & Dimensions */}
                <div className="space-y-2.5">
                  {roomDimensions.map((candidate, index) => {
                    const room = getRoomDetails(candidate, index);
                    const isAlreadyVerified = savedMeasurements.some(
                      (m) =>
                        m.measurementType === room.type ||
                        (Math.abs(m.verifiedValue1 - room.cleanVal1) < 0.05 &&
                          m.verifiedValue2 != null &&
                          Math.abs(m.verifiedValue2 - room.cleanVal2) < 0.05)
                    );
                    const area = (room.cleanVal1 * room.cleanVal2).toFixed(2);

                    return (
                      <div
                        key={`${candidate.source_page}-${candidate.source_text}-${index}`}
                        className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                          isAlreadyVerified
                            ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                            : activeCandidate === candidate
                            ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-400'
                            : 'border-amber-200 bg-white hover:border-amber-400 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-lg">{room.icon}</span>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">
                                {room.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                Raw OCR: “{candidate.source_text}” (Page {candidate.source_page})
                              </span>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${
                              isAlreadyVerified
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {isAlreadyVerified ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Verified in MySQL</span>
                              </>
                            ) : (
                              <span>Pending Verification</span>
                            )}
                          </span>
                        </div>

                        {/* Dimensions & Area summary bar */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                              Room Dimensions
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {room.cleanVal1} {candidate.unit || 'm'} × {room.cleanVal2} {candidate.unit || 'm'}
                              {candidate.unit === 'cm' && (
                                <span className="text-[10px] text-slate-500 font-normal ml-1">
                                  ({(room.cleanVal1 / 100).toFixed(2)}m × {(room.cleanVal2 / 100).toFixed(2)}m)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                              Calculated Area
                            </span>
                            <span className="font-mono font-bold text-blue-700 text-xs">
                              {formatCalculatedArea(room.cleanVal1, room.cleanVal2, candidate.unit)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <p className="text-[10px] text-slate-500 truncate max-w-[240px]">
                            Line: “{candidate.line_text}”
                          </p>

                          <button
                            type="button"
                            onClick={() => handleSelectCandidate(candidate, index)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer ${
                              isAlreadyVerified
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isAlreadyVerified ? 'Edit Measurement' : 'Review & Edit'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SECTION: Interactive Officer Verification Form */}
              {activeCandidate && (
                <section className="rounded-lg border border-blue-300 bg-blue-50/80 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-700" />
                      <span>Verify / Correct Measurement: “{activeCandidate.source_text}”</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveCandidate(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  {measurementError && (
                    <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                      {measurementError}
                    </div>
                  )}

                  <form onSubmit={handleSaveMeasurement} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Measurement Meaning / Type
                        </label>
                        <select
                          value={measurementType}
                          onChange={(e) => setMeasurementType(e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        >
                          <option value="ROOM_DIMENSIONS">Room Dimensions (Length × Width)</option>
                          <option value="FRONT_SETBACK">Front Setback</option>
                          <option value="REAR_SETBACK">Rear Setback</option>
                          <option value="SIDE_SETBACK">Side Setback</option>
                          <option value="PLOT_BOUNDARY">Plot Boundary Dimension</option>
                          <option value="BUILDING_HEIGHT">Building Height</option>
                          <option value="ROAD_WIDTH">Abutting Road Width</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Measurement Unit
                        </label>
                        <select
                          value={selectedUnit}
                          onChange={(e) => setSelectedUnit(e.target.value as any)}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        >
                          <option value="m">Metres (m)</option>
                          <option value="ft">Feet (ft)</option>
                          <option value="mm">Millimetres (mm)</option>
                          <option value="cm">Centimetres (cm)</option>
                          <option value="in">Inches (in)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Verified Value 1 (Length/Width)
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={verifiedVal1}
                          onChange={(e) => {
                            setVerifiedVal1(e.target.value);
                            if (parseFloat(e.target.value) !== activeCandidate.first_dimension) {
                              setVerificationStatus('CORRECTED');
                            }
                          }}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        />
                        <span className="text-[10px] text-slate-500">
                          Original OCR: {activeCandidate.first_dimension}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Verified Value 2 (Optional)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={verifiedVal2}
                          onChange={(e) => {
                            setVerifiedVal2(e.target.value);
                            if (
                              parseFloat(e.target.value) !== activeCandidate.second_dimension
                            ) {
                              setVerificationStatus('CORRECTED');
                            }
                          }}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        />
                        <span className="text-[10px] text-slate-500">
                          Original OCR: {activeCandidate.second_dimension ?? 'None'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Verification Status
                        </label>
                        <select
                          value={verificationStatus}
                          onChange={(e) => setVerificationStatus(e.target.value as any)}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        >
                          <option value="VERIFIED">VERIFIED (Confirmed against plan)</option>
                          <option value="CORRECTED">CORRECTED (Officer modified value)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Officer Inspection Remarks
                        </label>
                        <input
                          type="text"
                          value={officerRemarks}
                          onChange={(e) => setOfficerRemarks(e.target.value)}
                          placeholder="e.g. Master Bedroom dimensions confirmed"
                          className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingMeasurement}
                      className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {isSavingMeasurement ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to MySQL...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm &amp; Save Verified Measurement</span>
                        </>
                      )}
                    </button>
                  </form>
                </section>
              )}

              {measurementMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{measurementMessage}</span>
                </div>
              )}

              {/* SECTION: Officer-Verified Measurements Stored in Database */}
              {savedMeasurements.length > 0 && (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Officer-Verified Measurements ({savedMeasurements.length})</span>
                    </h4>
                    <span className="text-[10px] text-emerald-800 font-semibold">
                      Stored in MySQL
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {savedMeasurements.map((m) => (
                      <div
                        key={m.id}
                        className="p-2 bg-white rounded border border-emerald-200 text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-900">{m.measurementType}</strong>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                m.verificationStatus === 'CORRECTED'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {m.verificationStatus}
                            </span>
                          </div>
                          <div className="text-slate-600 text-[11px] mt-0.5">
                            Verified:{' '}
                            <span className="font-mono font-semibold">
                              {m.verifiedValue1}
                              {m.verifiedValue2 != null ? ` × ${m.verifiedValue2}` : ''} {m.unit}
                            </span>
                            {m.originalValue1 != null && (
                              <span className="text-slate-400 ml-1.5">
                                (Orig: {m.originalValue1}
                                {m.originalValue2 != null ? ` × ${m.originalValue2}` : ''})
                              </span>
                            )}
                          </div>
                          {m.officerRemarks && (
                            <div className="text-[10px] text-slate-500 italic">
                              “{m.officerRemarks}”
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          ID: #{m.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION: Statutory Rule Scrutiny Matrix */}
              <section className="space-y-3 pt-2 border-t border-slate-200">
                {/* Statutory AI Score & Threshold Status Banner */}
                {(() => {
                  const passedCount = backendReport?.ruleResults?.filter((r) => r.status === 'PASS').length ?? 0;
                  const totalCount = backendReport?.ruleResults?.length ?? 5;
                  const complianceScore = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 100;
                  const meetsThreshold = complianceScore >= 80;

                  return (
                    <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      meetsThreshold
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50/80 border-rose-300 text-rose-950'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base font-mono border shadow-sm ${
                          meetsThreshold
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-rose-100 border-rose-300 text-rose-800'
                        }`}>
                          {complianceScore}%
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs uppercase tracking-wide text-slate-900">
                              Statutory Scrutiny Score
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              meetsThreshold
                                ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                                : 'bg-rose-200 text-rose-900 border-rose-400'
                            }`}>
                              {meetsThreshold ? '≥ 80% Threshold Met' : '< 80% Below Threshold'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {meetsThreshold
                              ? `Passed ${passedCount} of ${totalCount} statutory rules under TNCDBR 2019. Recommended for sanction approval.`
                              : `Passed ${passedCount} of ${totalCount} rules under TNCDBR 2019. Technical corrections required.`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-500 block">Fast-Track Benchmark</span>
                        <span className="text-xs font-bold text-slate-800">80% Statutory Norm</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                    Statutory Rule Scrutiny Matrix (TNCDBR 2019)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">Official Municipal Rules</span>
                </div>

                {backendReport?.ruleResults && backendReport.ruleResults.length > 0 ? (
                  backendReport.ruleResults.map((check, index) => {
                    const isPass = check.status === 'PASS';
                    const isFail = check.status === 'FAIL';
                    const isReview = check.status === 'NEEDS_REVIEW';

                    return (
                      <div
                        key={check.id || index}
                        className={`p-3 rounded-lg border text-xs transition-colors ${
                          isPass
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : isFail
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                            {isPass ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : isFail ? (
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <span className="text-[11px] capitalize">
                              {check.rule_name || check.rule_code.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                              isPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : isFail
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {check.status}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-600 space-y-0.5 font-mono pl-5">
                          <div>Required: {check.required_value}</div>
                          <div>Actual / Found: {check.actual_value}</div>
                          {check.fix_hint && (
                            <div className="font-sans italic text-slate-500 mt-0.5">
                              {check.fix_hint}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : app?.aiReport ? (
                  app.aiReport.checks?.map((check, index) => (
                    <div
                      key={index}
                      className={`p-2.5 rounded-lg border text-xs ${
                        check.status === 'pass'
                          ? 'bg-white border-slate-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                          {check.status === 'pass' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span className="text-[11px]">{check.rule}</span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                            check.status === 'pass'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {check.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 space-y-0.5 font-mono pl-5">
                        <div>Required: {check.required}</div>
                        <div>Found: {check.found}</div>
                        <div className="font-sans italic text-slate-500 mt-0.5">{check.remark}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500 bg-slate-50 rounded border border-slate-200">
                    <p className="text-xs">
                      No statutory rule checks have been computed yet. Trigger AI scrutiny to
                      evaluate rules against extracted &amp; verified measurements.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Tab 2: Officer Action Desk */}
          {activeTab === 'actions' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Correction Notice Points */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Statutory Correction Points ({editableCorrections.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">Officer Discretion</span>
                </div>

                <div className="space-y-2">
                  {editableCorrections.map((correction) => (
                    <div
                      key={correction.id}
                      className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-amber-900 block text-[11px]">
                          {correction.section}
                        </span>
                        <p className="text-slate-700 text-[11px] mt-0.5 leading-relaxed">
                          {correction.point}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Reference: {correction.ruleRef}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCorrection(correction.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Delete correction point"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new correction point */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <input
                    type="text"
                    value={newCorrectionPoint}
                    onChange={(e) => setNewCorrectionPoint(e.target.value)}
                    placeholder="Enter statutory correction requirement..."
                    className="w-full text-xs p-2 rounded border border-slate-300"
                  />

                  <select
                    value={newCorrectionSection}
                    onChange={(e) => setNewCorrectionSection(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-slate-300"
                  >
                    <option value="Setbacks & Open Spaces">Setbacks &amp; Open Spaces</option>
                    <option value="FSI & Plot Coverage">FSI &amp; Plot Coverage</option>
                    <option value="Building Geometry & Height">
                      Building Geometry &amp; Height
                    </option>
                    <option value="Parking & Vehicular Circulation">
                      Parking &amp; Vehicular Circulation
                    </option>
                    <option value="Environmental & Rainwater Harvesting">
                      Environmental &amp; Rainwater Harvesting
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={handleAddCorrection}
                    className="w-full py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded font-medium flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Append Correction Item</span>
                  </button>
                </div>
              </div>

              {/* Conditions editor */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Approval Conditions</h4>

                {conditions.map((condition, index) => (
                  <div
                    key={`${index}-${condition}`}
                    className="flex items-start justify-between gap-2 p-2 rounded bg-blue-50 border border-blue-100"
                  >
                    <p className="text-[11px] text-slate-700">{condition}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(index)}
                      className="text-slate-400 hover:text-rose-600"
                      title="Remove condition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder="Add an approval condition..."
                  className="w-full text-xs p-2 rounded border border-slate-300"
                />

                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="w-full py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-200"
                >
                  Add Condition
                </button>
              </div>

              {/* Rejection reason */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <label
                  htmlFor="rejection-reason"
                  className="text-xs font-bold text-slate-900 uppercase block"
                >
                  Rejection Reason
                </label>

                <textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2 rounded border border-slate-300"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-900 uppercase">
                  Statutory Sanction Actions
                </div>

                {actionError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{actionError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActionError(null)}
                      className="text-rose-600 font-bold hover:text-rose-800"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {backendApp?.status === 'APPROVED' ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
                    <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Sanction Granted &amp; Order Issued</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      This application has been formally approved under TNCDBR 2019 statutory rules. An official municipal sanction permit with SHA-256 cryptographic hash has been generated.
                    </p>
                    <Link
                      to={`/verify/${encodeURIComponent(backendApp.applicationNumber)}`}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>View &amp; Print Sanction Order Permit</span>
                    </Link>
                  </div>
                ) : backendApp?.status === 'REJECTED' ? (
                  <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs">
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>Application Rejected</span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      Reason: {backendApp.rejectionReason || 'Non-conformance with applicable building regulations.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      id="btn-approve-sanction"
                      disabled={isProcessing}
                      onClick={() => openApproveModal(false)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve &amp; Issue Sanction Order</span>
                    </button>

                    <button
                      type="button"
                      id="btn-approve-conditions"
                      disabled={isProcessing}
                      onClick={() => openApproveModal(true)}
                      className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Approve with Standard Conditions</span>
                    </button>

                    <button
                      type="button"
                      id="btn-issue-corrections"
                      disabled={isProcessing}
                      onClick={openCorrectionsModal}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Issue Correction Notice ({editableCorrections.length})</span>
                    </button>

                    <button
                      type="button"
                      id="btn-reject-proposal"
                      disabled={isProcessing}
                      onClick={openRejectModal}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Application</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Site and Building Specifications */}
          {activeTab === 'drawing_meta' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-bold text-blue-900 uppercase text-[11px]">
                  Site Coordinates &amp; Location
                </div>
                <div>
                  <strong>Taluk / Region:</strong> {effectiveTaluk}
                </div>
                <div>
                  <strong>Survey Number:</strong> {effectiveSurveyNo}
                </div>
                <div>
                  <strong>Plot Number:</strong> {backendApp?.plotNumber || 'Plot 101'}
                </div>
                <div>
                  <strong>Abutting Road:</strong>{' '}
                  {backendApp?.roadWidth != null
                    ? `${backendApp.roadWidth} metres`
                    : `${app?.plotDetails?.abuttingRoadWidthM || 7.5} metres`}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-bold text-blue-900 uppercase text-[11px]">
                  Building Dimensions &amp; Geometric Areas
                </div>
                <div>
                  <strong>Plot Extent:</strong>{' '}
                  {backendApp?.plotArea != null
                    ? `${backendApp.plotArea} sq.m`
                    : `${app?.plotAreaSqm || 240} sq.m`}
                </div>
                <div>
                  <strong>Number of Floors:</strong>{' '}
                  {backendApp?.floors != null ? backendApp.floors : app?.floors || 2}
                </div>
                <div>
                  <strong>Built-Up Area:</strong>{' '}
                  {backendReport?.metrics?.built_up_area != null
                    ? `${backendReport.metrics.built_up_area} sq.m`
                    : `${app?.builtUpAreaSqm || 192} sq.m`}
                </div>
                <div>
                  <strong>Ground Coverage:</strong>{' '}
                  {backendReport?.metrics?.ground_coverage_percent != null
                    ? `${backendReport.metrics.ground_coverage_percent}%`
                    : 'Requires Verified Footprint'}
                </div>
                <div>
                  <strong>FSI / FAR:</strong>{' '}
                  {backendReport?.metrics?.far != null
                    ? backendReport.metrics.far
                    : app?.fsi || 'Provisional Review'}
                </div>
                <div>
                  <strong>Proposed Height:</strong>{' '}
                  {backendReport?.metrics?.building_height != null
                    ? `${backendReport.metrics.building_height}m`
                    : `${app?.proposedHeightM || 7.0}m`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Officer Confirmation & Decision Modal (In-App Dialog, 100% reliable) */}
      {activeModal && (
        <div
          id="officer-decision-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activeModal.type === 'APPROVE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : activeModal.type === 'APPROVE_WITH_CONDITIONS'
                      ? 'bg-blue-100 text-blue-700'
                      : activeModal.type === 'CORRECTIONS'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {activeModal.type === 'APPROVE' && <CheckCircle2 className="w-5 h-5" />}
                  {activeModal.type === 'APPROVE_WITH_CONDITIONS' && (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                  {activeModal.type === 'CORRECTIONS' && <AlertTriangle className="w-5 h-5" />}
                  {activeModal.type === 'REJECT' && <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{activeModal.title}</h3>
                  <p className="text-[11px] text-slate-500">{backendApp?.applicationNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setActionError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-700">
              <p className="text-xs leading-relaxed text-slate-600">{activeModal.subtitle}</p>

              {/* Error inside modal */}
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Specific details depending on action */}
              {activeModal.type === 'APPROVE' && (
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                  <div className="font-bold text-emerald-900 text-xs">
                    Sanction Determination Summary
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800">
                    <div>
                      Applicant: <strong>{effectiveApplicantName}</strong>
                    </div>
                    <div>
                      Plot Extent: <strong>{backendApp?.plotArea || 240} sq.m</strong>
                    </div>
                    <div>
                      Survey No: <strong>{effectiveSurveyNo}</strong>
                    </div>
                    <div>
                      Building: <strong>{effectiveBuildingType}</strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-700 italic pt-1 border-t border-emerald-200">
                    Upon confirmation, an official municipal building permit sanction certificate
                    with a cryptographic SHA-256 seal will be registered in MySQL.
                  </p>
                </div>
              )}

              {activeModal.type === 'APPROVE_WITH_CONDITIONS' && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 text-xs">
                    Standard Municipal Conditions ({conditions.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {conditions.map((cond, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-blue-50/60 border border-blue-100 rounded text-[11px] text-slate-700 flex items-start gap-1.5"
                      >
                        <span className="font-bold text-blue-700">{idx + 1}.</span>
                        <span>{cond}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModal.type === 'CORRECTIONS' && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 text-xs">
                    Correction Notice Items ({editableCorrections.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {editableCorrections.map((corr, idx) => (
                      <div
                        key={corr.id}
                        className="p-2 bg-amber-50/60 border border-amber-200 rounded text-[11px] text-slate-700"
                      >
                        <div className="font-bold text-amber-900">
                          {idx + 1}. [{corr.section}]
                        </div>
                        <div className="mt-0.5">{corr.point}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModal.type === 'REJECT' && (
                <div className="space-y-2">
                  <label className="font-bold text-rose-950 text-xs block">
                    Statutory Grounds for Rejection (Mandatory)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Specify detailed non-conformance reasons under TNCDBR 2019..."
                    className="w-full p-2.5 rounded-lg border border-rose-300 bg-rose-50/30 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    This official statement will be communicated to the applicant on their citizen
                    tracking portal with statutory citations.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setActiveModal(null);
                  setActionError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-officer-modal"
                disabled={isProcessing}
                onClick={handleConfirmModalAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 ${activeModal.confirmBgClass}`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{activeModal.confirmText}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
