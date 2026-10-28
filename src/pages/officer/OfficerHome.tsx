import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser, useApplications } from '../../services/store';
import { StatusBadge } from '../../components/common/StatusBadge';
import { fetchApplicationsForOfficer, BackendApplication } from '../../services/applicationApi';
import { ApplicationStatus, BuildingType } from '../../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileSearch, 
  ArrowRight, 
  Calendar,
  Sparkles,
  Layers,
  FileCheck2,
  XCircle
} from 'lucide-react';

export const OfficerHome: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { applications, stats } = useApplications();
  const [backendApps, setBackendApps] = useState<BackendApplication[]>([]);

  const officerId = 2;

  useEffect(() => {
    let cancelled = false;
    fetchApplicationsForOfficer(officerId)
      .then((apps) => {
        if (!cancelled) setBackendApps(apps);
      })
      .catch((err) => console.error('Failed to load officer applications:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Region-scoped queue
  const officerRegion = currentUser.region || 'Tiruchengode';
  const localRegionApps = applications.filter(a => a.plotDetails.region === officerRegion);

  // Unify backend applications with local applications
  const unifiedOfficerApps = [
    ...backendApps.map((b) => {
      const existing = localRegionApps.find(
        (m) =>
          m.applicationNo.toLowerCase() === b.applicationNumber.toLowerCase() ||
          String(m.id) === String(b.id)
      );
      const normalizedStatus = String(b.status || 'submitted').toLowerCase().replace(/s_required$/, '_required');
      return {
        id: String(b.id),
        applicationNo: b.applicationNumber,
        applicantName: existing?.applicantName || 'Citizen Applicant',
        plotDetails: {
          surveyNo: b.surveyNumber || existing?.plotDetails?.surveyNo || '142/3A',
          taluk: existing?.plotDetails?.taluk || 'Tiruchengode',
          ward: existing?.plotDetails?.ward || 'Ward 4',
          region: officerRegion,
        },
        buildingType: (b.buildingType || existing?.buildingType || 'residential') as BuildingType,
        floors: b.floors || existing?.floors || 2,
        plotAreaSqm: b.plotArea || existing?.plotAreaSqm || 240,
        builtUpAreaSqm: existing?.builtUpAreaSqm || (b.plotArea ? Math.round(b.plotArea * 1.5) : 320),
        aiReport: {
          complianceScore: b.complianceScore ?? (normalizedStatus === 'approved' ? 100 : 85),
          summary:
            normalizedStatus === 'approved'
              ? 'Statutory building scrutiny confirmed compliant under TNCDBR 2019.'
              : 'Automated plan scrutiny ready for officer inspection.',
        },
        status: normalizedStatus as ApplicationStatus,
        submittedAt: b.submittedAt || existing?.submittedAt || new Date().toISOString(),
      };
    }),
    ...localRegionApps
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

  const pending = unifiedOfficerApps.filter(
    (a) => a.status === 'officer_review' || a.status === 'submitted' || a.status === 'under_ai_review'
  );
  const approved = unifiedOfficerApps.filter((a) => a.status === 'approved');
  const corrections = unifiedOfficerApps.filter((a) => a.status === 'correction_required');
  const rejected = unifiedOfficerApps.filter((a) => a.status === 'rejected');

  // Chart data
  const chartData = [
    { month: 'Feb', applications: 4, approved: 3 },
    { month: 'Mar', applications: 6, approved: 5 },
    { month: 'Apr', applications: 7, approved: 6 },
    { month: 'May', applications: 9, approved: 7 },
    { month: 'Jun', applications: 8, approved: 7 },
    { month: 'Jul', applications: 11, approved: 9 },
    { month: 'Aug', applications: 13, approved: 10 },
    { month: 'Sep', applications: 10, approved: 8 },
  ];

  return (
    <div className="space-y-6">
      {/* Officer Welcome Header */}
      <div className="bg-[#0b2545] text-white p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-800 text-blue-200 text-xs font-semibold mb-2 border border-blue-600/40">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{officerRegion} Municipal Planning Desk</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Town Planning Officer: {currentUser.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Namakkal District Local Planning Authority • Statutory technical scrutiny and building permit sanction desk under TNCDBR 2019.
            </p>
          </div>

          <Link
            to="/officer/applications"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center space-x-2 shrink-0 transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>Open Sanction Queue ({pending.length})</span>
          </Link>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Pending Review</span>
            <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2 font-mono">{pending.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting officer sanction</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Sanctions Approved</span>
            <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">{approved.length}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">Permits generated with QR</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Corrections Raised</span>
            <div className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">{corrections.length}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">With applicant for revision</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Avg Decision Time</span>
            <div className="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-900 mt-2 font-mono">2.4 Days</div>
          <div className="text-[11px] text-slate-500 mt-1">TNCDBR standard: &lt; 15 days</div>
        </div>
      </div>

      {/* Chart & Queue Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monthly Volume Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-900" />
              <span>Monthly Sanctions ({officerRegion})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Application flow over the past 8 months</p>
          </div>

          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="applications" fill="#3b82f6" name="Submitted" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" fill="#10b981" name="Sanctioned" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center space-x-4 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span>Submitted</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              <span>Sanctioned</span>
            </span>
          </div>
        </div>

        {/* Right: Urgent Pending Review Queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSearch className="w-5 h-5 text-blue-900" />
              <h3 className="text-sm font-bold text-slate-900">
                Action Required: Applications Awaiting Scrutiny ({pending.length})
              </h3>
            </div>
            <Link
              to="/officer/applications"
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View Full Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-200 flex-1 overflow-auto">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-medium">All applications in {officerRegion} are up to date.</p>
              </div>
            ) : (
              [...pending]
                .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime() || Number(b.id) - Number(a.id))
                .slice(0, 6)
                .map((app) => (
                <div key={app.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">{app.applicationNo}</span>
                      <StatusBadge status={app.status} size="sm" />
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                        {app.buildingType}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 font-semibold">{app.applicantName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>S.No {app.plotDetails.surveyNo}</span>
                      <span>•</span>
                      <span>Plot: {app.plotAreaSqm} m²</span>
                      <span>•</span>
                      <span>Built: {app.builtUpAreaSqm} m² (G+{app.floors - 1})</span>
                      {app.aiReport && (
                        <>
                          <span>•</span>
                          <span className="text-blue-700 font-mono font-bold">
                            AI Score: {app.aiReport.complianceScore}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Link
                    to={`/officer/review/${encodeURIComponent(app.id)}`}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm shrink-0"
                  >
                    <span>Scrutinize</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
