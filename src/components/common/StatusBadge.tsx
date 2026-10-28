import React from 'react';
import { ApplicationStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Sparkles, FileSearch } from 'lucide-react';

interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showIcon = true }) => {
  const configs: Record<ApplicationStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    submitted: {
      label: 'Submitted',
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      border: 'border-slate-300',
      icon: Clock
    },
    under_ai_review: {
      label: 'Under AI Scrutiny',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      icon: Sparkles
    },
    officer_review: {
      label: 'Officer Scrutiny',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: FileSearch
    },
    correction_required: {
      label: 'Correction Required',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
      icon: AlertTriangle
    },
    approved: {
      label: 'Sanction Approved',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      icon: CheckCircle2
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-300',
      icon: XCircle
    }
  };

  const key = String(status || '').toLowerCase().replace(/s_required$/, '_required') as ApplicationStatus;
  const config = configs[key] || configs[status] || configs.submitted;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-medium px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2'
  };

  return (
    <span className={`inline-flex items-center rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}>
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      <span>{config.label}</span>
    </span>
  );
};
