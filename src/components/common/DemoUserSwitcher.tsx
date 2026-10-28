import React from 'react';
import { useCurrentUser, useApplications } from '../../services/store';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../../types';
import { Shield, User, Building, RotateCcw, Check, Sparkles } from 'lucide-react';

export const DemoUserSwitcher: React.FC = () => {
  const { currentUser, switchUserByRole } = useCurrentUser();
  const { resetDemoData } = useApplications();
  const navigate = useNavigate();

  const handleSwitch = (role: UserRole) => {
    switchUserByRole(role);
    if (role === 'client') {
      navigate('/client');
    } else {
      navigate('/officer');
    }
  };

  const roles: { role: UserRole; title: string; subtitle: string; icon: any }[] = [
    {
      role: 'client',
      title: 'Applicant / Architect',
      subtitle: 'Client Portal',
      icon: User
    },
    {
      role: 'officer',
      title: 'Town Planning Officer',
      subtitle: 'Tiruchengode Region',
      icon: Building
    }
  ];

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 text-xs py-1.5 px-4 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* State / Region Indicator */}
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-slate-300">
            Tamil Nadu Municipal Scrutiny Portal: <strong className="text-white">Namakkal District</strong>
          </span>
        </div>

        {/* 1-Click Role Switcher */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 hidden sm:inline mr-1 text-[11px]">Role Persona:</span>
          {roles.map((r) => {
            const isActive = currentUser.role === r.role;
            const Icon = r.icon;
            return (
              <button
                key={r.role}
                onClick={() => handleSwitch(r.role)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={`Switch to ${r.title} (${r.subtitle})`}
              >
                <Icon className="w-3 h-3" />
                <span>{r.title.split(' ')[0]}</span>
                {isActive && <Check className="w-3 h-3 ml-0.5 text-blue-200" />}
              </button>
            );
          })}

          <button
            onClick={() => {
              if (confirm('Reset application queue to initial 40+ Tamil Nadu demo applications?')) {
                resetDemoData();
                window.location.reload();
              }
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded ml-2"
            title="Reset demo records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
