import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser, useApplications } from '../../services/store';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ComplianceGauge } from '../../components/common/ComplianceGauge';
import { fetchApplications, BackendApplication } from '../../services/applicationApi';
import { ApplicationStatus, BuildingType } from '../../types';
import { 
  FilePlus2, 
  SearchCheck, 
  Download, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Sparkles, 
  Building2,
  FileCheck2,
  Info,
  XCircle
} from 'lucide-react';

export const ClientHome: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { applications } = useApplications();
  const [backendApps, setBackendApps] = useState<BackendApplication[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchApplications()
      .then((apps) => {
        if (!cancelled) setBackendApps(apps);
      })
      .catch((err) => console.error('Failed to load live applications on dashboard:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter client's applications
  const myApps = applications.filter(a => 
    a.applicantId === currentUser.uid || 
    a.applicantName.toLowerCase().includes('murugesan')
  );

  // Unify backend applications with local applications
  const unifiedApps = [
    ...backendApps.map((b) => {
      const existing = myApps.find(
        (m) =>
          m.applicationNo.toLowerCase() === b.applicationNumber.toLowerCase() ||
          String(m.id) === String(b.id)
      );
      const normalizedStatus = String(b.status || 'submitted').toLowerCase().replace(/s_required$/, '_required');
      return {
        id: String(b.id),
        applicationNo: b.applicationNumber,
        plotDetails: {
          surveyNo: b.surveyNumber || existing?.plotDetails?.surveyNo || '142/3A',
          taluk: existing?.plotDetails?.taluk || 'Tiruchengode',
          ward: existing?.plotDetails?.ward || 'Ward 4',
        },
        buildingType: (b.buildingType || existing?.buildingType || 'residential') as BuildingType,
        floors: b.floors || existing?.floors || 2,
        plotAreaSqm: b.plotArea || existing?.plotAreaSqm || 240,
        builtUpAreaSqm: existing?.builtUpAreaSqm || (b.plotArea ? Math.round(b.plotArea * 1.5) : 320),
        aiReport: {
          complianceScore: b.complianceScore ?? (existing?.aiReport?.complianceScore || (normalizedStatus === 'approved' ? 100 : 85)),
          summary:
            normalizedStatus === 'approved'
              ? 'Statutory building scrutiny confirmed compliant under TNCDBR 2019. Official sanction order issued.'
              : normalizedStatus === 'rejected'
              ? (b.rejectionReason || 'Building proposal rejected by Town Planning Authority. See official rejection notice.')
              : normalizedStatus === 'officer_review'
              ? 'Automated plan scrutiny completed. Under technical review by Town Planning Officer.'
              : 'Automated plan scrutiny submitted to Town Planning Officer.',
        },
        rejectionReason: b.rejectionReason || existing?.rejectionReason,
        status: normalizedStatus as ApplicationStatus,
        submittedAt: b.submittedAt || existing?.submittedAt || new Date().toISOString(),
      };
    }),
    ...myApps
      .filter(
        (m) =>
          !backendApps.some(
            (b) => b.applicationNumber.toLowerCase() === m.applicationNo.toLowerCase()
          )
      )
      .map((m) => ({
        ...m,
        status: String(m.status).toLowerCase().replace(/s_required$/, '_required') as ApplicationStatus,
      })),
  ];

  const total = unifiedApps.length;
  const approved = unifiedApps.filter(a => a.status === 'approved').length;
  const inReview = unifiedApps.filter(a => a.status === 'submitted' || a.status === 'under_ai_review' || a.status === 'officer_review').length;
  const corrections = unifiedApps.filter(a => a.status === 'correction_required').length;
  const rejected = unifiedApps.filter(a => a.status === 'rejected').length;

  const latestApps = [...unifiedApps]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime() || Number(b.id) - Number(a.id))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Official Greeting Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-[#0b2545] to-blue-900 rounded-xl p-6 text-white shadow-md border border-blue-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-800/80 text-blue-200 text-xs font-medium mb-2 border border-blue-600/40">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Smart Building Scrutiny Portal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Vanakkam, {currentUser.name}
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Welcome to the Directorate of Town and Country Planning (DTCP) automated building plan sanction desk. Submit CAD/PDF drawings for instant TNCDBR 2019 pre-scrutiny and track permit issuance.
            </p>
          </div>

          <Link
            to="/client/apply"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition-all shrink-0 hover:scale-[1.02]"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Apply for New Plan Sanction</span>
          </Link>
        </div>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Total Applications</span>
            <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">{total}</div>
          <div className="text-[11px] text-slate-500 mt-1">Namakkal Municipal Region</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Sanctioned & Approved</span>
            <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">{approved}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">Permit order ready</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Under Scrutiny</span>
            <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2 font-mono">{inReview}</div>
          <div className="text-[11px] text-slate-500 mt-1">AI / Officer desk</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Corrections Required</span>
            <div className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">{corrections}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Action required</div>
        </div>
      </div>

      {/* Latest Applications Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-blue-900" />
            <h3 className="text-base font-bold text-slate-900">Recent Building Plan Applications</h3>
          </div>
          <Link
            to="/client/history"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
          >
            <span>View All Applications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {latestApps.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">No applications submitted yet.</p>
            <Link
              to="/client/apply"
              className="mt-3 inline-flex items-center space-x-1 px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-lg"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Submit First Application</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {latestApps.map((app) => (
              <div key={app.id} className="p-6 hover:bg-slate-50/80 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{app.applicationNo}</span>
                      <StatusBadge status={app.status} />
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                        {app.buildingType}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                      <span>Survey No: <strong className="text-slate-800">{app.plotDetails.surveyNo}</strong> ({app.plotDetails.ward})</span>
                      <span>•</span>
                      <span>Taluk: <strong className="text-slate-800">{app.plotDetails.taluk}</strong></span>
                      <span>•</span>
                      <span>Plot Area: <strong className="text-slate-800">{app.plotAreaSqm} sq.m</strong></span>
                      <span>•</span>
                      <span>Built-Up: <strong className="text-slate-800">{app.builtUpAreaSqm} sq.m</strong> (G+{app.floors - 1})</span>
                    </div>

                    {app.aiReport && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5 mt-2 max-w-3xl">
                        <div className="flex items-center gap-1.5 font-medium text-blue-900 mb-0.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>AI Scrutiny Verdict (Score: {app.aiReport.complianceScore}%):</span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 text-[11px] leading-relaxed">
                          {app.aiReport.summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions & Compliance preview */}
                  <div className="flex items-center space-x-3 shrink-0">
                    {app.aiReport && (
                      <ComplianceGauge score={app.aiReport.complianceScore} size="sm" />
                    )}

                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                      <Link
                        to={`/client/status?app=${encodeURIComponent(app.applicationNo)}`}
                        className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-colors"
                      >
                        <SearchCheck className="w-3.5 h-3.5" />
                        <span>Track Status</span>
                      </Link>

                      {app.status === 'approved' && (
                        <Link
                          to={`/verify/${encodeURIComponent(app.applicationNo)}`}
                          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs font-semibold transition-colors"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Sanction Permit</span>
                        </Link>
                      )}

                      {app.status === 'correction_required' && (
                        <Link
                          to={`/client/status?app=${encodeURIComponent(app.applicationNo)}`}
                          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 text-xs font-bold transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Fix Corrections</span>
                        </Link>
                      )}

                      {app.status === 'rejected' && (
                        <Link
                          to={`/client/status?app=${encodeURIComponent(app.applicationNo)}`}
                          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 text-xs font-bold transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rejection Details</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guidelines Box */}
      <div className="bg-slate-100 border border-slate-300 rounded-xl p-5">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-700">
            <h4 className="font-bold text-slate-900 text-sm">Key Checklist for Faster Sanction Approval</h4>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-slate-600">
              <li className="bg-white p-2.5 rounded border border-slate-200">
                <strong className="text-slate-900 block mb-0.5">1. Drawing Formats</strong>
                Submit minimum 1 PDF drawing sheet. AutoCAD .DXF files enable automated vector layer extraction. Max 25MB.
              </li>
              <li className="bg-white p-2.5 rounded border border-slate-200">
                <strong className="text-slate-900 block mb-0.5">2. Setback Clearances</strong>
                Ensure mandatory front, rear, and side yards adhere to TNCDBR Rule 38 based on proposed building height.
              </li>
              <li className="bg-white p-2.5 rounded border border-slate-200">
                <strong className="text-slate-900 block mb-0.5">3. Rainwater Harvesting</strong>
                RWH percolation pit / recharge chamber is mandatory under Section 240-A for all building approvals.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
