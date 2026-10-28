import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../services/store';
import { DEMO_USERS } from '../../services/seedData';
import { UserRole } from '../../types';
import { 
  Building2, 
  Shield, 
  User, 
  Lock, 
  Mail, 
  Check, 
  Sparkles, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const Login: React.FC = () => {
  const { setCurrentUser, switchUserByRole } = useCurrentUser();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');

  const roleAccounts: Record<UserRole, { label: string; email: string }> = {
    client: { label: 'Citizen', email: 'citizen@gmail.com' },
    officer: { label: 'Municipal Officer', email: 'officer@gmail.com' },
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase()) || {
      uid: `user-${Date.now()}`,
      name: email.split('@')[0],
      email,
      role,
      phone: '+91 94432 00000',
      region: 'Tiruchengode' as const,
      district: 'Namakkal' as const,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(matched);
    if (matched.role === 'client') navigate('/client');
    else navigate('/officer');
  };

  const handleDemoSelect = (roleName: UserRole) => {
    switchUserByRole(roleName);
    if (roleName === 'client') navigate('/client');
    else navigate('/officer');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Emblem Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Building2 className="w-8 h-8 text-amber-400" />
        </div>
        <div className="text-xs uppercase tracking-widest font-semibold text-amber-300">
          Government of Tamil Nadu
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          PlanSanction
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Smart Municipal Building Plan Approval & Scrutiny Portal (TNCDBR 2019)
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700 space-y-6">
          {/* Quick 1-Click Demo Login Personas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Select Role
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                Role-based sign-in
              </span>
            </div>

            <div className="space-y-2">
              {/* Persona 1: Client */}
              <button
                type="button"
                onClick={() => handleDemoSelect('client')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all group cursor-pointer"
                title="Instant Sign In as Citizen"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-900">
                      Citizen (Applicant)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {roleAccounts.client.email} • Click to enter Citizen Desk
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>

              {/* Persona 2: Officer */}
              <button
                type="button"
                onClick={() => handleDemoSelect('officer')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between text-left transition-all group cursor-pointer"
                title="Instant Sign In as Municipal Officer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-900">
                      Municipal Officer (Scrutiny)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {roleAccounts.officer.email} • Click to enter Officer Action Desk
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>


            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-500">Enter your role username and password</span>
            </div>
          </div>

          {/* Standard Form */}
          <form onSubmit={handleCustomLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username / Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder={roleAccounts[role].email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Login Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white capitalize font-medium"
              >
                <option value="client">Citizen</option>
                <option value="officer">Municipal Officer</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
            >
              Sign In to PlanSanction
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
