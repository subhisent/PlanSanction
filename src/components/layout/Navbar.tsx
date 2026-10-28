import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../services/store';
import { 
  Building2, 
  FilePlus2, 
  SearchCheck, 
  History, 
  User, 
  LayoutDashboard, 
  Layers, 
  Users, 
  ShieldAlert, 
  LogOut, 
  FileCheck2,
  ExternalLink
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, logout } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  const getNavLinks = () => {
    if (currentUser.role === 'client') {
      return [
        { path: '/client', label: 'Home', icon: Building2 },
        { path: '/client/apply', label: 'New Application', icon: FilePlus2 },
        { path: '/client/status', label: 'Track Status', icon: SearchCheck },
        { path: '/client/history', label: 'History & Permits', icon: History },
        { path: '/client/profile', label: 'My Profile', icon: User },
      ];
    } else {
      return [
        { path: '/officer', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/officer/applications', label: 'Applications Queue', icon: Layers },
        { path: '/officer/applicants', label: 'Applicants Directory', icon: Users },
        { path: '/officer/profile', label: 'Jurisdiction Profile', icon: User },
      ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <header className="bg-[#0b2545] border-b border-slate-700 text-white shadow-md">
      {/* Top Gold & Navy Government Branding Bar */}
      <div className="bg-[#081c33] border-b border-blue-950/60 py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Tamil Nadu Emblem Icon Motif */}
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center p-1.5 shadow-inner">
              <svg viewBox="0 0 24 24" className="w-full h-full text-amber-400 fill-current">
                <path d="M12 2L4 7v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 2.18l6 3.75v4.57c0 4.38-2.92 8.52-6 9.68-3.08-1.16-6-5.3-6-9.68V7.93l6-3.75zM12 6a4 4 0 100 8 4 4 0 000-8z"/>
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                <span>Government of Tamil Nadu</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300 font-normal">TNCDBR 2019 Scrutiny Portal</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>PlanSanction</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-800/80 text-blue-200 border border-blue-600/40">
                  {currentUser.district} District
                </span>
              </h1>
            </div>
          </div>

          {/* User Profile Capsule */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{currentUser.name}</div>
              <div className="text-[11px] text-slate-300">
                <span className="capitalize font-medium text-amber-400">{currentUser.role}</span>
                {currentUser.role === 'officer' && ` • ${currentUser.region}`}
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-blue-700 border border-blue-500 flex items-center justify-center text-white font-bold text-xs">
              {currentUser.name.charAt(0)}
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-red-400 hover:bg-red-950/40 hover:text-white"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Links Bar */}
      <div className="px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto">
          <nav className="flex space-x-1 sm:space-x-2 py-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path !== '/client' && link.path !== '/officer' && location.pathname.startsWith(link.path));
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-inner'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-2 py-1 pl-4 shrink-0">
            <Link
              to="/verify"
              className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 text-xs text-amber-300 bg-amber-950/40 border border-amber-600/50 rounded hover:bg-amber-900/60 transition-colors"
            >
              <SearchCheck className="w-3.5 h-3.5" />
              <span>Verify Permit</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
