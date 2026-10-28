import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApplications, useCurrentUser } from '../../services/store';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ApplicationStatus, BuildingType } from '../../types';
import {
  fetchApplicationsForOfficer,
  type BackendApplication
} from '../../services/applicationApi';
import { 
  Layers, 
  Search, 
  Filter, 
  FileSearch, 
  FileCheck2, 
  ArrowUpDown, 
  Calendar,
  Building,
  CheckCircle2
} from 'lucide-react';

const normalizeStatus = (status: string): ApplicationStatus => {
  const normalized = status.toLowerCase();

  const allowedStatuses: ApplicationStatus[] = [
    'submitted',
    'under_ai_review',
    'officer_review',
    'correction_required',
    'approved',
    'rejected',
  ];

  return allowedStatuses.includes(normalized as ApplicationStatus)
    ? (normalized as ApplicationStatus)
    : 'submitted';
};

export const OfficerApplications: React.FC = () => {
   const { currentUser } = useCurrentUser();

  // Temporary test ID: officer 2 in the MySQL users table.
  const officerId = 2;

  const [applications, setApplications] = useState<BackendApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    fetchApplicationsForOfficer(officerId)
      .then(setApplications)
      .catch((error: Error) => setApiError(error.message))
      .finally(() => setLoading(false));
  }, []);

  const officerRegion = currentUser.region || 'Tiruchengode';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('2026');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'score-desc' | 'score-asc'>('date-desc');

  // Filter applications by officer's region
 const regionApps = applications;

  const filtered = regionApps.filter(app => {
  const matchesSearch =
    app.applicationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (app.plotNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (app.surveyNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase());

  const matchesStatus = statusFilter === 'all' || app.status.toLowerCase() === statusFilter.toLowerCase();
  const matchesType = typeFilter === 'all' || (app.buildingType ?? '').toLowerCase() === typeFilter.toLowerCase();
  const matchesYear = yearFilter === 'all' || (app.submittedAt ?? '').startsWith(yearFilter);

  return matchesSearch && matchesStatus && matchesType && matchesYear;
});

 
  // Sort applications returned by the backend.
  filtered.sort((a, b) => {
    const dateA = a.submittedAt
      ? new Date(a.submittedAt).getTime()
      : 0;

    const dateB = b.submittedAt
      ? new Date(b.submittedAt).getTime()
      : 0;

    if (sortBy === 'date-desc') return dateB - dateA;
    if (sortBy === 'date-asc') return dateA - dateB;
    if (sortBy === 'score-desc') return (b.complianceScore ?? 0) - (a.complianceScore ?? 0);
    if (sortBy === 'score-asc') return (a.complianceScore ?? 0) - (b.complianceScore ?? 0);
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-900" />
            <h2 className="text-lg font-bold text-slate-900">
              {officerRegion} Region Sanction Applications Queue
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Statutory building permit scrutinies assigned to {currentUser.name} ({officerRegion} Municipal Planning Area).
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-3 py-1.5 bg-blue-50 text-blue-900 rounded-lg border border-blue-200 font-bold">
            Total in Region: {regionApps.length}
          </span>
          <span className="px-3 py-1.5 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 font-bold">
            Pending: {regionApps.filter(a => a.status === 'officer_review' || a.status === 'submitted' || a.status === 'under_ai_review').length}
          </span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Applicant, Survey No, Application No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="officer_review">Under Officer Scrutiny</option>
            <option value="under_ai_review">Under AI Scrutiny</option>
            <option value="submitted">Submitted</option>
            <option value="correction_required">Correction Required</option>
            <option value="approved">Approved</option>
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
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="date-desc">Sort: Newest First</option>
            <option value="date-asc">Sort: Oldest First</option>
            <option value="score-desc">Sort: AI Score (High → Low)</option>
            <option value="score-asc">Sort: AI Score (Low → High)</option>
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Application No</th>
                <th className="py-3.5 px-4">Applicant / Architect</th>
                <th className="py-3.5 px-4">Plot & Survey</th>
                <th className="py-3.5 px-4">Category & Envelope</th>
                <th className="py-3.5 px-4">AI Score</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No applications match the current filter criteria for {officerRegion}.
                  </td>
                </tr>
              ) : (
                filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                      <Link to={`/officer/review/${encodeURIComponent(app.id)}`} className="hover:underline">
                        {app.applicationNumber}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{'Applicant details not linked'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{'—'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-800">
                      <div className="font-semibold">S.No. {app.surveyNumber ?? '—'}</div>
                      <div className="text-[11px] text-slate-500">{app.plotNumber ?? '—'} • Road: {app.plotArea ?? '—'}m</div>
                    </td>

                    <td className="py-3.5 px-4 capitalize">
                      <span className="font-medium text-slate-800">{app.buildingType}</span>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {app.plotArea ?? '—'} m² (G+{app.floors ?? '—'})
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {app.complianceScore != null ? (
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                app.complianceScore >= 80
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : app.complianceScore >= 60
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {app.complianceScore}%
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-tight ${
                              app.complianceScore >= 80
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {app.complianceScore >= 80 ? '≥ 80% Meets Threshold' : '< 80% Scrutiny Required'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={normalizeStatus(app.status)} />
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                      {app.submittedAt
                                  ? new Date(app.submittedAt).toLocaleDateString('en-IN')
                                   : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/officer/review/${encodeURIComponent(app.id)}`}
                        className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded text-xs font-bold shadow-xs transition-colors ${
                          app.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-blue-700 hover:bg-blue-800 text-white'
                        }`}
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        <span>{app.status === 'approved' ? 'Permit View' : 'Scrutinize'}</span>
                      </Link>
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
