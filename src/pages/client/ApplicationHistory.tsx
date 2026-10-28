import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApplications, useCurrentUser } from '../../services/store';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ApplicationStatus, BuildingType } from '../../types';
import { fetchApplications, BackendApplication } from '../../services/applicationApi';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  SearchCheck, 
  FileCheck2, 
  FileText, 
  Building,
  Calendar,
  ExternalLink
} from 'lucide-react';

export const ApplicationHistory: React.FC = () => {
  const { applications } = useApplications();
  const { currentUser } = useCurrentUser();

  const [backendApps, setBackendApps] = useState<BackendApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('2026');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    fetchApplications()
      .then((apps) => {
        if (!cancelled) setBackendApps(apps);
      })
      .catch((err) => console.error('Failed to load live applications:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter client's applications
  const myApps = applications.filter(a => 
    a.applicantId === currentUser.uid || 
    a.applicantName.toLowerCase().includes('murugesan')
  );

  // Merge live backend applications into view
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
        proposedHeightM: existing?.proposedHeightM || (b.floors ? b.floors * 3.2 : 6.4),
        builtUpAreaSqm: existing?.builtUpAreaSqm || (b.plotArea ? Math.round(b.plotArea * 1.5) : 320),
        plotAreaSqm: b.plotArea || existing?.plotAreaSqm || 240,
        aiReport: existing?.aiReport || {
          complianceScore: normalizedStatus === 'approved' ? 100 : 85,
        },
        status: normalizedStatus,
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
        status: String(m.status).toLowerCase().replace(/s_required$/, '_required'),
      })),
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime() || Number(b.id) - Number(a.id));

  const filteredApps = unifiedApps.filter(app => {
    const matchesQuery = 
      app.applicationNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.plotDetails.surveyNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.plotDetails.taluk.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesYear = yearFilter === 'all' || app.submittedAt.startsWith(yearFilter);
    const matchesType = typeFilter === 'all' || app.buildingType === typeFilter;

    return matchesQuery && matchesStatus && matchesYear && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-900" />
            <h2 className="text-lg font-bold text-slate-900">
              Building Plan Sanction Permit History
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete archive of building permit submissions, AI scrutiny findings, and sanctioned orders.
          </p>
        </div>

        <Link
          to="/client/apply"
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <span>+ New Permit Application</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Survey / App No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Sanction Statuses</option>
            <option value="approved">Approved & Sanctioned</option>
            <option value="officer_review">Under Officer Scrutiny</option>
            <option value="under_ai_review">Under AI Scrutiny</option>
            <option value="correction_required">Correction Required</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white capitalize"
          >
            <option value="all">All Building Types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="industrial">Industrial</option>
            <option value="institutional">Institutional</option>
          </select>
        </div>

        <div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Submission Years</option>
            <option value="2026">Year 2026</option>
            <option value="2025">Year 2025</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Application No</th>
                <th className="py-3.5 px-4">Plot & Survey Details</th>
                <th className="py-3.5 px-4">Type & Floors</th>
                <th className="py-3.5 px-4">Built-Up Area</th>
                <th className="py-3.5 px-4">AI Score</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date Submitted</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No building applications match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                      <Link
                        to={`/client/status?app=${encodeURIComponent(app.applicationNo)}`}
                        className="hover:underline"
                      >
                        {app.applicationNo}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 text-slate-800">
                      <div className="font-semibold">S.No. {app.plotDetails.surveyNo}</div>
                      <div className="text-[11px] text-slate-500">
                        {app.plotDetails.taluk}, {app.plotDetails.ward}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 capitalize">
                      <span className="font-medium text-slate-800">{app.buildingType}</span>
                      <div className="text-[11px] text-slate-500 font-mono">
                        G+{app.floors - 1} ({app.proposedHeightM}m)
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-slate-900 font-semibold">{app.builtUpAreaSqm} m²</span>
                      <div className="text-[10px] text-slate-500">Plot: {app.plotAreaSqm} m²</div>
                    </td>

                    <td className="py-3.5 px-4">
                      {app.aiReport ? (
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          app.aiReport.complianceScore >= 85
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : app.aiReport.complianceScore >= 70
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {app.aiReport.complianceScore}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={app.status as ApplicationStatus} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                      {new Date(app.submittedAt).toLocaleDateString('en-GB')}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to={`/client/status?app=${encodeURIComponent(app.applicationNo)}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded font-medium transition-colors"
                        title="View Status & Report"
                      >
                        <SearchCheck className="w-3.5 h-3.5" />
                        <span>Track</span>
                      </Link>

                      {app.status === 'approved' && (
                        <Link
                          to={`/verify/${encodeURIComponent(app.applicationNo)}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-semibold transition-colors"
                          title="Download Official Sanction Certificate"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Permit</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
