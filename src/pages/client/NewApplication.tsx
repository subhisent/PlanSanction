import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useApplications } from '../../services/store';
import { BuildingType, Region, UploadedPlanFile } from '../../types';
import { parseDxfFile } from '../../services/dxfParser';
import { saveUploadedDocument } from '../../services/documentStorage';
import { preprocessPlanImage } from '../../services/imagePreprocessing';
import { extractPlanText, PlanOcrResult } from '../../services/planOcr';
import { getUploadedDocument } from '../../services/documentStorage';
import { uploadApplicationDocument } from '../../services/applicationApi';
import { 
  Building2, 
  MapPin, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Layers, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Box, 
  Loader2 
} from 'lucide-react';

export const NewApplication: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { createApplication } = useApplications();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  // Step 1: Applicant Details
  const [applicantName, setApplicantName] = useState(currentUser.name);
  const [applicantEmail, setApplicantEmail] = useState(currentUser.email);
  const [applicantPhone, setApplicantPhone] = useState(currentUser.phone);
  const [applicantAadhaar, setApplicantAadhaar] = useState('7845-9821-4321');
  const [applicantAddress, setApplicantAddress] = useState('45, Gandhi Nagar, Tiruchengode, Namakkal - 637211');

  // Step 2: Plot & Building Details
  const [taluk, setTaluk] = useState<Region>('Tiruchengode');
  const [surveyNo, setSurveyNo] = useState('142/3A');
  const [pattaNo, setPattaNo] = useState('PTA/2026/8912');
  const [ward, setWard] = useState('Ward 08');
  const [street, setStreet] = useState('Sankari Main Road');
  const [village, setVillage] = useState('Tiruchengode Town');
  const [buildingType, setBuildingType] = useState<BuildingType>('residential');
  const [plotAreaSqm, setPlotAreaSqm] = useState(240);
  const [builtUpAreaSqm, setBuiltUpAreaSqm] = useState(280);
  const [floors, setFloors] = useState(2);
  const [proposedHeightM, setProposedHeightM] = useState(7.2);
  const [roadWidthM, setRoadWidthM] = useState(12.0);
  const [frontageM, setFrontageM] = useState(15.0);

  // Setbacks
  const [frontSetback, setFrontSetback] = useState(3.0);
  const [rearSetback, setRearSetback] = useState(1.8);
  const [leftSetback, setLeftSetback] = useState(1.5);
  const [rightSetback, setRightSetback] = useState(1.5);

  // Amenities & Standards
  const [parkingCars, setParkingCars] = useState(1);
  const [parkingTwoWheelers, setParkingTwoWheelers] = useState(2);
  const [rwhProvided, setRwhProvided] = useState(true);
  const [staircaseWidthM, setStaircaseWidthM] = useState(1.25);

  // Step 3: Files & CAD Uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPlanFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Handle file selection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setUploadProgress(10);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext || '');

      if (file.size > 25 * 1024 * 1024) {
        setUploadError(`File ${file.name} exceeds the 25MB maximum limit.`);
        setUploadProgress(null);
        return;
      }

      if (ext !== 'pdf' && ext !== 'dwg' && ext !== 'dxf' && !isImage) {
        setUploadError(`Unsupported file type (.${ext}). Only PDF, DWG, DXF, JPG, PNG, and WebP are accepted.`);
        setUploadProgress(null);
        return;
      }

      setUploadProgress(50);

      let uploadFile = file;
      let originalStoragePath: string | undefined;
      if (isImage) {
        try {
          uploadFile = await preprocessPlanImage(file);
          originalStoragePath = `local-documents/${crypto.randomUUID()}`;
          await saveUploadedDocument(originalStoragePath, file);
        } catch (error) {
          console.error('Image preprocessing failed:', error);
          setUploadError(`Could not preprocess ${file.name}. Please try another image.`);
          setUploadProgress(null);
          return;
        }
      }

      let ocr: PlanOcrResult | undefined;
      if (ext === 'pdf' || isImage) {
        try {
          ocr = await extractPlanText(uploadFile, ext === 'pdf');
        } catch (error) {
          console.error('Plan OCR failed:', error);
          setUploadError(`Text extraction failed for ${file.name}. The drawing was uploaded; enter dimensions manually.`);
        }
      }

      let dxfInfo = undefined;
      if (ext === 'dxf') {
        try {
          dxfInfo = await parseDxfFile(file);
        } catch (err) {
          console.warn('DXF parse error', err);
        }
      }

      setUploadProgress(85);

      const storagePath = `local-documents/${crypto.randomUUID()}`;
      try {
        await saveUploadedDocument(storagePath, uploadFile);
      } catch (error) {
        console.error('Failed to save uploaded document:', error);
        setUploadError(`Could not save ${file.name}. Please try again.`);
        setUploadProgress(null);
        return;
      }

      const newFileObj: UploadedPlanFile = {
        name: file.name,
        type: isImage ? 'image' : ext as 'pdf' | 'dwg' | 'dxf',
        storagePath,
        originalStoragePath,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        ocr,
        dxfInfo
      };

      setUploadedFiles(prev => [...prev.filter(f => f.name !== file.name), newFileObj]);
    }

    setUploadProgress(100);
    setTimeout(() => setUploadProgress(null), 600);
    e.target.value = '';
  };

  const handleRemoveFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleAttachSampleDrawing = async () => {
    try {
      setUploadProgress(20);
      setUploadError(null);
      const res = await fetch('/sample_building_plan.pdf');
      if (!res.ok) throw new Error('Sample plan file not found in public folder');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'bp.pdf', { type: 'application/pdf' });

      setUploadProgress(60);
      let ocr: PlanOcrResult | undefined;
      try {
        ocr = await extractPlanText(sampleFile, true);
      } catch (err) {
        console.warn('Sample PDF OCR extraction fallback:', err);
      }

      const storagePath = `local-documents/${crypto.randomUUID()}`;
      await saveUploadedDocument(storagePath, sampleFile);

      setUploadedFiles(prev => [
        ...prev.filter(f => f.name !== 'bp.pdf'),
        {
          name: sampleFile.name,
          type: 'pdf',
          storagePath,
          sizeBytes: sampleFile.size,
          uploadedAt: new Date().toISOString(),
          ocr,
        }
      ]);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 500);
    } catch (err) {
      console.error('Failed to load sample drawing:', err);
      setUploadError('Could not load sample drawing file. Please select a local PDF file.');
      setUploadProgress(null);
    }
  };

  const applyOcrMeasurements = (ocr: PlanOcrResult) => {
    const measurements = ocr.measurements;
    if (measurements.plotAreaSqm) setPlotAreaSqm(measurements.plotAreaSqm);
    if (measurements.builtUpAreaSqm) setBuiltUpAreaSqm(measurements.builtUpAreaSqm);
    if (measurements.roadWidthM) setRoadWidthM(measurements.roadWidthM);
    if (measurements.frontageM) setFrontageM(measurements.frontageM);
    if (measurements.frontSetbackM) setFrontSetback(measurements.frontSetbackM);
    if (measurements.rearSetbackM) setRearSetback(measurements.rearSetbackM);
    if (measurements.leftSetbackM) setLeftSetback(measurements.leftSetbackM);
    if (measurements.rightSetbackM) setRightSetback(measurements.rightSetbackM);
    setCurrentStep(2);
  };

  // Validations per step
  const validateStep = (step: number) => {
    if (step === 1) {
      return applicantName.trim().length > 0 && applicantPhone.trim().length > 5;
    }
    if (step === 2) {
      return surveyNo.trim().length > 0 && plotAreaSqm > 10 && builtUpAreaSqm > 10;
    }
    if (step === 3) {
      return uploadedFiles.some(f => f.type === 'pdf');
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      if (currentStep === 3) {
        setUploadError('At least one architectural PDF drawing sheet is mandatory for scrutiny.');
      } else {
        alert('Please complete the mandatory required fields before continuing.');
      }
      return;
    }
    setCurrentStep(s => Math.min(4, s + 1));
  };

  
const handleSubmit = async () => {
  setIsSubmitting(true);

  console.log('Submitting applicant email:', applicantEmail);

  let createdApplicationNo: string | null = null;

  try {
    // 1. Create the application in MySQL through Spring Boot.
    const created = await createApplication({
      applicantId: currentUser.uid,
      applicantName,
      applicantPhone,
      applicantEmail,
      applicantAadhaar,
      applicantAddress,
      plotDetails: {
        surveyNo,
        pattaNo,
        ward,
        street,
        village,
        taluk,
        region: taluk,
        district: 'Namakkal',
        abuttingRoadWidthM: roadWidthM,
        frontageM,
      },
      buildingType,
      plotAreaSqm,
      builtUpAreaSqm,
      groundCoveragePercentage: Math.round(
        (builtUpAreaSqm / (floors * plotAreaSqm)) * 100
      ),
      fsi: Number((builtUpAreaSqm / plotAreaSqm).toFixed(2)),
      floors,
      proposedHeightM,
      setbacks: {
        front: frontSetback,
        rear: rearSetback,
        left: leftSetback,
        right: rightSetback,
      },
      parkingSpacesCar: parkingCars,
      parkingSpacesTwoWheeler: parkingTwoWheelers,
      rainwaterHarvestingProvided: rwhProvided,
      staircaseWidthM,
      files: uploadedFiles,
    });

    createdApplicationNo = created.applicationNo;

    // 2. Get the real backend application ID.
    const backendApplicationId = Number(created.id);

    if (
      !Number.isSafeInteger(backendApplicationId) ||
      backendApplicationId <= 0
    ) {
      throw new Error(
        `Application ${created.applicationNo} was created, but its backend ID is invalid.`
      );
    }

    // 3. Upload every selected document to Spring Boot.
    for (const uploaded of uploadedFiles) {
      const storedBlob = await getUploadedDocument(
        uploaded.storagePath
      );

      if (!storedBlob) {
        throw new Error(
          `Application ${created.applicationNo} was created, but "${uploaded.name}" could not be retrieved from browser storage.`
        );
      }

      const fileToUpload = new File(
        [storedBlob],
        uploaded.name,
        {
          type:
            storedBlob.type ||
            'application/octet-stream',
        }
      );

      await uploadApplicationDocument(
        backendApplicationId,
        fileToUpload,
        1
      );

      console.log(
        `Uploaded "${uploaded.name}" for application ${created.applicationNo}`
      );
    }

    // 4. Redirect only after all selected files upload successfully.
    navigate(
      `/client/status?app=${encodeURIComponent(created.applicationNo)}`
    );
  } catch (err) {
    console.error('Application submission/upload failed:', err);

    const message =
      err instanceof Error ? err.message : String(err);

    if (createdApplicationNo) {
      alert(
        `Application ${createdApplicationNo} was created, but document upload or final submission processing failed.\n\n${message}\n\nDo not submit the application again yet. Check the application's documents in MySQL first.`
      );
    } else {
      alert(`Application submission failed: ${message}`);
    }
  } finally {
    setIsSubmitting(false);
  }
};
  const steps = [
    { num: 1, title: 'Applicant Details', icon: Building2 },
    { num: 2, title: 'Plot & Building Geometry', icon: MapPin },
    { num: 3, title: 'Upload Drawings (CAD/PDF)', icon: UploadCloud },
    { num: 4, title: 'Review & AI Scrutiny', icon: Sparkles },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          New Building Plan Sanction Application
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Directorate of Town and Country Planning (DTCP) • Automated Scrutiny under Tamil Nadu Combined Development and Building Rules, 2019
        </p>

        {/* Wizard Stepper Progress Bar */}
        <div className="mt-6 grid grid-cols-4 gap-2">
          {steps.map((s) => {
            const isDone = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                onClick={() => isDone && setCurrentStep(s.num)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  isDone
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 cursor-pointer'
                    : isCurrent
                    ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5 mb-1">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-blue-700' : 'text-slate-400'}`} />
                  )}
                  <span className="text-xs font-bold font-mono">Step {s.num}</span>
                </div>
                <div className="text-[11px] font-medium truncate">{s.title}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Form Panels */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
        {/* STEP 1: Applicant Details */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Step 1: Applicant & Developer Information</h3>
              <p className="text-xs text-slate-500">Provide legal property owner or registered architect details.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Applicant / Architect / Firm Name *
                </label>
                <input
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. S. K. Murugesan & Associates"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aadhaar / Registered License No.
                </label>
                <input
                  type="text"
                  value={applicantAadhaar}
                  onChange={(e) => setApplicantAadhaar(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="XXXX-XXXX-XXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (For SMS Sanction Alerts) *
                </label>
                <input
                  type="text"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="+91 94432 XXXXX"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (Read-Only Verified)
                </label>
                <input
                  type="email"
                  value={applicantEmail}
                  readOnly
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Applicant Postal Address
                </label>
                <textarea
                  rows={2}
                  value={applicantAddress}
                  onChange={(e) => setApplicantAddress(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Door No, Street, Town, District, PIN code"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Plot & Building Geometry */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Step 2: Plot Details & Building Specifications</h3>
              <p className="text-xs text-slate-500">Dimensions used by the AI engine to evaluate TNCDBR 2019 compliance.</p>
            </div>

            {/* Location & Survey details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taluk / Municipal Jurisdiction *
                </label>
                <select
                  value={taluk}
                  onChange={(e) => setTaluk(e.target.value as Region)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="Tiruchengode">Tiruchengode (TCG)</option>
                  <option value="Rasipuram">Rasipuram (RSP)</option>
                  <option value="Kumarapalayam">Kumarapalayam (KMP)</option>
                  <option value="Paramathi-Velur">Paramathi-Velur (PMV)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revenue Survey Number *
                </label>
                <input
                  type="text"
                  value={surveyNo}
                  onChange={(e) => setSurveyNo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  placeholder="e.g. 142/3A"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patta / Ward Number
                </label>
                <input
                  type="text"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Ward 08"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Site Street Address
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Sankari Main Road"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Building Category *
                </label>
                <select
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value as BuildingType)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium capitalize"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="institutional">Institutional</option>
                </select>
              </div>
            </div>

            {/* Areas and Geometry Grid */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3">
                Building Dimensions & Envelopes
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Plot Extent (sq.m) *
                  </label>
                  <input
                    type="number"
                    value={plotAreaSqm}
                    onChange={(e) => setPlotAreaSqm(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={20}
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    ~{(plotAreaSqm * 10.7639).toFixed(0)} sq.ft
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Total Built-Up Area (sq.m) *
                  </label>
                  <input
                    type="number"
                    value={builtUpAreaSqm}
                    onChange={(e) => setBuiltUpAreaSqm(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={20}
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    FSI: {(builtUpAreaSqm / Math.max(1, plotAreaSqm)).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Number of Floors *
                  </label>
                  <input
                    type="number"
                    value={floors}
                    onChange={(e) => setFloors(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={1}
                    max={15}
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    G + {Math.max(0, floors - 1)}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Proposed Height (metres) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={proposedHeightM}
                    onChange={(e) => setProposedHeightM(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={3}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Abutting Road Width (m) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={roadWidthM}
                    onChange={(e) => setRoadWidthM(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={3}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Plot Frontage (m) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={frontageM}
                    onChange={(e) => setFrontageM(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={3}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Car Parking Slots
                  </label>
                  <input
                    type="number"
                    value={parkingCars}
                    onChange={(e) => setParkingCars(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Two-Wheeler Slots
                  </label>
                  <input
                    type="number"
                    value={parkingTwoWheelers}
                    onChange={(e) => setParkingTwoWheelers(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* Setbacks Group */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                Mandatory Open Yard Setbacks (in Metres)
              </h4>
              <p className="text-[11px] text-slate-500 mb-3">Clear open distance from outer plinth wall to boundary line.</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Front Setback (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={frontSetback}
                    onChange={(e) => setFrontSetback(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={0.5}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Rear Setback (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={rearSetback}
                    onChange={(e) => setRearSetback(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={0.5}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Left Side Yard (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={leftSetback}
                    onChange={(e) => setLeftSetback(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={0.5}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Right Side Yard (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={rightSetback}
                    onChange={(e) => setRightSetback(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                    min={0.5}
                  />
                </div>
              </div>
            </div>

            {/* Environmental & Safety Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={rwhProvided}
                  onChange={(e) => setRwhProvided(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">
                    Rainwater Harvesting (RWH) Structure Provided *
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Mandatory percolation pit / recharge well integrated into site drainage layout.
                  </span>
                </div>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staircase Minimum Clear Flight Width (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={staircaseWidthM}
                  onChange={(e) => setStaircaseWidthM(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded border border-slate-300 font-mono"
                  min={0.8}
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  TNCDBR Rule 48 requires min 1.0m (res) / 1.5m (comm)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Drawing & CAD Uploads */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Step 3: Upload Architectural & CAD Drawing Files</h3>
              <p className="text-xs text-slate-500">
                Accepts PDF, CAD, and plan images (Max 25MB each). OCR reads labeled dimensions from PDFs and images for review.
              </p>
            </div>

            {/* Upload Zone */}
            <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 rounded-xl p-6 text-center transition-colors">
              <UploadCloud className="w-10 h-10 text-blue-700 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-900">
                Drag & drop your drawing files here, or click to browse
              </div>
              <p className="text-xs text-slate-500 mt-1">
                AutoCAD DXF vector layers are parsed automatically for geometry and setbacks scrutiny.
              </p>

              <input
                type="file"
                multiple
                accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                className="hidden"
                id="plan-file-input"
              />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <label
                  htmlFor="plan-file-input"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Select CAD / PDF / Image Files</span>
                </label>
                <button
                  type="button"
                  onClick={handleAttachSampleDrawing}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                  title="Use standard test architectural plan (bp.pdf)"
                >
                  <FileText className="w-4 h-4" />
                  <span>Use Standard Sample Plan (TNCDBR PDF)</span>
                </button>
              </div>

              {uploadProgress !== null && (
                <div className="mt-4 max-w-xs mx-auto">
                  <div className="flex justify-between text-[11px] text-blue-900 font-medium mb-1">
                    <span>Preprocessing drawings and extracting text...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-700 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Uploaded Files Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Attached Drawing Sheets ({uploadedFiles.length})
              </h4>

              {uploadedFiles.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                  No files attached yet. Please upload at least one architectural PDF plan.
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((f, idx) => (
                    <div
                      key={f.name + idx}
                      className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-xs hover:border-slate-300"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs font-mono ${
                          f.type === 'pdf' ? 'bg-red-100 text-red-700' : f.type === 'dxf' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {f.type.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                            <span>{f.name}</span>
                            {f.type === 'dxf' && f.dxfInfo && (
                              <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.2 rounded">
                                {f.dxfInfo.layers.length} Layers Scanned
                              </span>
                            )}
                            {f.type === 'dwg' && (
                              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                                Binary — Companion PDF will be scrutinized
                              </span>
                            )}
                            {f.ocr && (
                              <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.2 rounded">
                                OCR {f.ocr.confidence}%
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {(f.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {new Date(f.uploadedAt).toLocaleTimeString()}
                          </div>
                          {f.ocr && Object.values(f.ocr.measurements).some(value => value !== undefined) && (
                            <button
                              type="button"
                              onClick={() => applyOcrMeasurements(f.ocr!)}
                              className="mt-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                            >
                              Apply detected dimensions to FSI / setback fields
                            </button>
                          )}
                          {f.ocr && (
                            <details className="mt-1 max-w-lg">
                              <summary className="cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                                View OCR text ({f.ocr.pageCount} page(s))
                              </summary>
                              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[10px] text-slate-600">
                                {f.ocr.text || 'No readable text detected.'}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(f.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Review & Pre-Scrutiny Verification */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Step 4: Scrutiny Summary & Final Submission</h3>
              <p className="text-xs text-slate-500">
                Verify application parameters before triggering the AI Scrutiny engine under TNCDBR 2019.
              </p>
            </div>

            {/* Structured Review Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-blue-900 uppercase">Applicant & Site Profile</div>
                <div className="text-xs space-y-1 text-slate-700">
                  <div><strong>Applicant:</strong> {applicantName}</div>
                  <div><strong>Phone:</strong> {applicantPhone}</div>
                  <div><strong>Taluk / District:</strong> {taluk}, Namakkal</div>
                  <div><strong>Survey / Ward:</strong> S.No. {surveyNo}, {ward}</div>
                  <div><strong>Abutting Road:</strong> {roadWidthM} metres</div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-blue-900 uppercase">Building Geometry & Rules Check</div>
                <div className="text-xs space-y-1 text-slate-700">
                  <div><strong>Category:</strong> <span className="capitalize">{buildingType}</span> (G+{floors - 1})</div>
                  <div><strong>Plot Extent:</strong> {plotAreaSqm} sq.m (~{(plotAreaSqm * 10.7639).toFixed(0)} sq.ft)</div>
                  <div><strong>Built-Up Area:</strong> {builtUpAreaSqm} sq.m (FSI: {(builtUpAreaSqm / plotAreaSqm).toFixed(2)})</div>
                  <div><strong>Front Setback:</strong> {frontSetback}m | <strong>Rear:</strong> {rearSetback}m</div>
                  <div><strong>Rainwater Harvesting:</strong> {rwhProvided ? 'Demarcated & Integrated' : 'Not Provided'}</div>
                </div>
              </div>
            </div>

            {/* AI Scrutiny notice */}
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-lg flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <strong className="block font-semibold mb-0.5">Automated AI Scrutiny Pipeline</strong>
                Upon submission, our Gemini 2.0 Flash engine will evaluate your drawing sheets against TNCDBR 2019 statutory tables for FSI, height envelope, setback clearance, and RWH compliance. A technical scrutiny report will be generated for the Town Planning Officer.
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(s => s - 1)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : <div />}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting & Scrutinizing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit Plan for AI Scrutiny</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
