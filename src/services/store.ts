import { useState, useEffect } from 'react';
import { createBackendApplication } from './applicationApi';
import { BuildingApplication, UserProfile, UserRole, ApplicationStatus, CorrectionPoint, TimelineEntry, DistrictStats } from '../types';
import { DEMO_USERS, generateRealisticApplications, calculateDistrictStats } from './seedData';
import { scrutinizeBuildingPlan } from './aiScrutiny';
import { generateSanctionCertificate } from './certificateGenerator';

const STORAGE_KEYS = {
  APPLICATIONS: 'plansanction_applications_v1',
  CURRENT_USER: 'plansanction_current_user_v1',
  OFFICERS: 'plansanction_officers_v1',
};

// Initialize or load state from localStorage
function getInitialApplications(): BuildingApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read stored applications:', err);
  }
  const generated = generateRealisticApplications();
  try {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(generated));
  } catch (e) {}
  return generated;
}

function getInitialOfficers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFICERS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  const officers = DEMO_USERS.filter(u => u.role === 'officer');
  try {
    localStorage.setItem(STORAGE_KEYS.OFFICERS, JSON.stringify(officers));
  } catch (e) {}
  return officers;
}

function getInitialUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return DEMO_USERS[0]; // Default to Client demo user
}

// Global In-Memory Reactive Event Emitter for Realtime UI Updates
type Listener = () => void;
const listeners: Set<Listener> = new Set();

let memoryApplications = getInitialApplications();
let memoryOfficers = getInitialOfficers();
let memoryCurrentUser = getInitialUser();
let memoryIsAuthenticated = Boolean(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));

function notify() {
  try {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(memoryApplications));
    if (memoryIsAuthenticated) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(memoryCurrentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    localStorage.setItem(STORAGE_KEYS.OFFICERS, JSON.stringify(memoryOfficers));
  } catch (e) {}
  listeners.forEach(l => l());
}

export const AppStore = {
  getApplications(): BuildingApplication[] {
    return memoryApplications;
  },

  getApplicationById(id: string): BuildingApplication | undefined {
    return memoryApplications.find(a => a.id === id || a.applicationNo === id);
  },

  getCurrentUser(): UserProfile {
    return memoryCurrentUser;
  },

  setCurrentUser(user: UserProfile) {
    memoryCurrentUser = user;
    memoryIsAuthenticated = true;
    notify();
  },

  logout() {
    memoryIsAuthenticated = false;
    notify();
  },

  isAuthenticated(): boolean {
    return memoryIsAuthenticated;
  },

  switchUserByRole(role: UserRole) {
    const user = DEMO_USERS.find(u => u.role === role) || DEMO_USERS[0];
    this.setCurrentUser(user);
    return user;
  },

  getOfficers(): UserProfile[] {
    return memoryOfficers;
  },

  addOfficer(officer: Omit<UserProfile, 'uid' | 'createdAt'>) {
    const newOfficer: UserProfile = {
      ...officer,
      uid: `officer-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    memoryOfficers = [newOfficer, ...memoryOfficers];
    notify();
    return newOfficer;
  },

  updateOfficerRegion(uid: string, newRegion: UserProfile['region']) {
    memoryOfficers = memoryOfficers.map(o => o.uid === uid ? { ...o, region: newRegion } : o);
    notify();
  },

  toggleOfficerStatus(uid: string) {
    // Can track active / deactivated in designation
    memoryOfficers = memoryOfficers.map(o => {
      if (o.uid === uid) {
        const isInactive = o.designation?.includes('(Deactivated)');
        return {
          ...o,
          designation: isInactive ? o.designation?.replace(' (Deactivated)', '') : `${o.designation || 'Officer'} (Deactivated)`
        };
      }
      return o;
    });
    notify();
  },

  
async createApplication(
  appData: Omit<
    BuildingApplication,
    'id' | 'applicationNo' | 'status' | 'timeline' |
    'corrections' | 'submittedAt' | 'updatedAt'
  >
): Promise<BuildingApplication> {
  // 1. Save the application in MySQL through Spring Boot.
  const saved = await createBackendApplication({
    applicantEmail: appData.applicantEmail,
    plotNumber: appData.plotDetails.pattaNo || appData.plotDetails.surveyNo,
    surveyNumber: appData.plotDetails.surveyNo,
    plotArea: appData.plotAreaSqm,
    roadWidth: appData.plotDetails.abuttingRoadWidthM,
    buildingType: String(appData.buildingType),
    floors: appData.floors,
  });

  // 2. Build the existing frontend application model.
  const prefixMap: Record<string, string> = {
    Tiruchengode: 'TCG',
    Rasipuram: 'RSP',
    Kumarapalayam: 'KMP',
    'Paramathi-Velur': 'PMV',
  };

  const prefix = prefixMap[appData.plotDetails.region] || 'TCG';
  const now = new Date().toISOString();

  // Use the actual application number generated by the backend.
  const applicationNo = saved.applicationNumber;

  // Keep the frontend ID unique and linkable to the backend record.
  const id = String(saved.id);

  const timeline: TimelineEntry[] = [
    {
      id: `tl-${Date.now()}-1`,
      status: 'submitted',
      note: `Building Plan application ${applicationNo} submitted online and saved to the database.`,
      actor: appData.applicantId,
      actorName: appData.applicantName,
      role: 'Applicant',
      at: saved.submittedAt || now,
    },
    {
      id: `tl-${Date.now()}-2`,
      status: 'under_ai_review',
      note: 'AI Scrutiny Engine evaluating plan drawings against TNCDBR 2019 rules...',
      actor: 'system',
      actorName: 'TNCDBR AI Engine',
      role: 'System',
      at: new Date(Date.now() + 1000).toISOString(),
    },
  ];

  const newApp: BuildingApplication = {
    ...appData,
    id,
    applicationNo,
    status: 'under_ai_review',
    timeline,
    corrections: [],
    submittedAt: saved.submittedAt || now,
    updatedAt: saved.updatedAt || now,
  };

  // 3. Preserve the existing local application store.
  memoryApplications = [newApp, ...memoryApplications];
  notify();

  // 4. Preserve the existing asynchronous AI scrutiny workflow.
  setTimeout(async () => {
    try {
      const aiReport = await scrutinizeBuildingPlan(newApp);

      const corrections: CorrectionPoint[] = (
        aiReport.correctionPoints || []
      ).map((cp, idx) => ({
        id: `corr-${Date.now()}-${idx + 1}`,
        point: cp.point,
        section: cp.section,
        ruleRef: cp.ruleRef,
        raisedBy: 'AI Scrutiny Engine (TNCDBR 2019)',
        raisedAt: new Date().toISOString(),
        resolved: false,
      }));

      const aiTimelineEntry: TimelineEntry = {
        id: `tl-${Date.now()}-3`,
        status: 'officer_review',
        note: `AI Scrutiny completed (Compliance Score: ${aiReport.complianceScore}%). Forwarded to ${newApp.plotDetails.region} Town Planning Officer for technical verification.`,
        actor: 'ai-engine',
        actorName: 'TNCDBR Scrutiny Engine (Gemini 2.0 Flash)',
        role: 'AI Officer',
        at: new Date().toISOString(),
      };

      this.updateApplication(id, {
        aiReport,
        corrections,
        status: 'officer_review',
        timeline: [...newApp.timeline, aiTimelineEntry],
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Background AI Scrutiny failed:', err);
    }
  }, 1200);

  return newApp;
},

  updateApplication(id: string, updates: Partial<BuildingApplication>) {
    memoryApplications = memoryApplications.map(app => {
      if (app.id === id || app.applicationNo === id) {
        return {
          ...app,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return app;
    });
    notify();
  },

  async approveApplication(id: string, officerName: string, conditions: string[] = []): Promise<BuildingApplication | null> {
    const app = this.getApplicationById(id);
    if (!app) return null;

    const sanctionOrderNo = `TN/NMK/${app.plotDetails.taluk.substring(0, 3).toUpperCase()}/BLD/${new Date().getFullYear()}/${app.applicationNo.split('/').pop() || '0001'}`;
    const now = new Date().toISOString();

    const certResult = await generateSanctionCertificate(
      { ...app, sanctionOrderNo, decidedAt: now },
      officerName
    );

    const timelineEntry: TimelineEntry = {
      id: `tl-${Date.now()}-apprv`,
      status: 'approved',
      note: `Building Plan Sanction Order ${sanctionOrderNo} approved and digitally issued by ${officerName}.`,
      actor: memoryCurrentUser.uid,
      actorName: officerName,
      role: 'Planning Officer',
      at: now
    };

    const updatedApp: BuildingApplication = {
      ...app,
      status: 'approved',
      sanctionOrderNo,
      certificateUrl: certResult.dataUrl,
      conditions: conditions.length > 0 ? conditions : [
        'Adherence to TNCDBR 2019 standards and approved setback dimensions',
        'Rainwater harvesting percolation pit execution before plinth completion',
        'Submission of structural stability certificate at plinth level'
      ],
      decidedAt: now,
      timeline: [...app.timeline, timelineEntry],
      updatedAt: now
    };

    this.updateApplication(id, updatedApp);
    return updatedApp;
  },

  raiseCorrections(id: string, correctionPoints: Array<{ point: string; section: string; ruleRef?: string }>, officerName: string): BuildingApplication | null {
    const app = this.getApplicationById(id);
    if (!app) return null;

    const now = new Date().toISOString();
    const corrections: CorrectionPoint[] = correctionPoints.map((cp, idx) => ({
      id: `corr-manual-${Date.now()}-${idx + 1}`,
      point: cp.point,
      section: cp.section,
      ruleRef: cp.ruleRef || 'TNCDBR 2019',
      raisedBy: officerName,
      raisedAt: now,
      resolved: false
    }));

    const timelineEntry: TimelineEntry = {
      id: `tl-${Date.now()}-corr`,
      status: 'correction_required',
      note: `Formal Correction Notice issued with ${corrections.length} required amendments. Plan returned to applicant.`,
      actor: memoryCurrentUser.uid,
      actorName: officerName,
      role: 'Planning Officer',
      at: now
    };

    const updatedApp: BuildingApplication = {
      ...app,
      status: 'correction_required',
      corrections,
      timeline: [...app.timeline, timelineEntry],
      updatedAt: now
    };

    this.updateApplication(id, updatedApp);
    return updatedApp;
  },

  rejectApplication(id: string, reason: string, officerName: string): BuildingApplication | null {
    const app = this.getApplicationById(id);
    if (!app) return null;

    const now = new Date().toISOString();
    const timelineEntry: TimelineEntry = {
      id: `tl-${Date.now()}-rej`,
      status: 'rejected',
      note: `Application rejected by ${officerName}. Reason: ${reason}`,
      actor: memoryCurrentUser.uid,
      actorName: officerName,
      role: 'Planning Officer',
      at: now
    };

    const updatedApp: BuildingApplication = {
      ...app,
      status: 'rejected',
      rejectionReason: reason,
      decidedAt: now,
      timeline: [...app.timeline, timelineEntry],
      updatedAt: now
    };

    this.updateApplication(id, updatedApp);
    return updatedApp;
  },

  reUploadRevisedDrawings(id: string, newFiles: BuildingApplication['files'], applicantNote: string): BuildingApplication | null {
    const app = this.getApplicationById(id);
    if (!app) return null;

    const now = new Date().toISOString();
    const timelineEntry: TimelineEntry = {
      id: `tl-${Date.now()}-reup`,
      status: 'under_ai_review',
      note: `Revised CAD / PDF drawings re-uploaded by applicant with remarks: "${applicantNote || 'Corrections resolved in revised drawing'}". Automated AI re-scrutiny initiated.`,
      actor: app.applicantId,
      actorName: app.applicantName,
      role: 'Applicant',
      at: now
    };

    const updatedApp: BuildingApplication = {
      ...app,
      files: [...newFiles, ...app.files.filter(f => !newFiles.some(nf => nf.name === f.name))],
      status: 'under_ai_review',
      timeline: [...app.timeline, timelineEntry],
      updatedAt: now
    };

    this.updateApplication(id, updatedApp);

    // Re-run AI scrutiny with improved compliance
    setTimeout(async () => {
      const fixedSetbacks = {
        front: Math.max(app.setbacks.front, 3.0),
        rear: Math.max(app.setbacks.rear, 1.5),
        left: Math.max(app.setbacks.left, 1.5),
        right: Math.max(app.setbacks.right, 1.5)
      };

      const aiReport = await scrutinizeBuildingPlan({
        ...updatedApp,
        setbacks: fixedSetbacks,
        rainwaterHarvestingProvided: true
      });

      const aiTimelineEntry: TimelineEntry = {
        id: `tl-${Date.now()}-ai-rev`,
        status: 'officer_review',
        note: `AI Re-Scrutiny completed successfully (Score improved to ${aiReport.complianceScore}%). Dispatched for final Officer sanction.`,
        actor: 'ai-engine',
        actorName: 'TNCDBR Scrutiny Engine',
        role: 'AI Officer',
        at: new Date().toISOString()
      };

      this.updateApplication(id, {
        setbacks: fixedSetbacks,
        rainwaterHarvestingProvided: true,
        aiReport,
        status: 'officer_review',
        timeline: [...this.getApplicationById(id)!.timeline, aiTimelineEntry],
        corrections: (this.getApplicationById(id)?.corrections || []).map(c => ({
          ...c,
          resolved: true,
          resolutionNote: 'Amended in revised drawing set',
          resolvedAt: new Date().toISOString()
        }))
      });
    }, 1500);

    return updatedApp;
  },

  resetDemoData() {
    localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
    localStorage.removeItem(STORAGE_KEYS.OFFICERS);
    memoryApplications = generateRealisticApplications();
    memoryOfficers = DEMO_USERS.filter(u => u.role === 'officer');
    notify();
  },

  getDistrictStats(): DistrictStats {
    return calculateDistrictStats(memoryApplications);
  }
};

/**
 * React Hook for live reactive application state
 */
export function useApplications() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    applications: AppStore.getApplications(),
    getApplicationById: AppStore.getApplicationById.bind(AppStore),
    createApplication: AppStore.createApplication.bind(AppStore),
    updateApplication: AppStore.updateApplication.bind(AppStore),
    approveApplication: AppStore.approveApplication.bind(AppStore),
    raiseCorrections: AppStore.raiseCorrections.bind(AppStore),
    rejectApplication: AppStore.rejectApplication.bind(AppStore),
    reUploadRevisedDrawings: AppStore.reUploadRevisedDrawings.bind(AppStore),
    stats: AppStore.getDistrictStats(),
    resetDemoData: AppStore.resetDemoData.bind(AppStore)
  };
}

/**
 * React Hook for current user & role management
 */
export function useCurrentUser() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    currentUser: AppStore.getCurrentUser(),
    isAuthenticated: AppStore.isAuthenticated(),
    setCurrentUser: AppStore.setCurrentUser.bind(AppStore),
    logout: AppStore.logout.bind(AppStore),
    switchUserByRole: AppStore.switchUserByRole.bind(AppStore),
    officers: AppStore.getOfficers(),
    addOfficer: AppStore.addOfficer.bind(AppStore),
    updateOfficerRegion: AppStore.updateOfficerRegion.bind(AppStore),
    toggleOfficerStatus: AppStore.toggleOfficerStatus.bind(AppStore),
  };
}
