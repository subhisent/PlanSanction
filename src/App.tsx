import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RoleRoute } from './components/common/RoleRoute';

// Auth
import { Login } from './pages/auth/Login';

// Client Pages
import { ClientHome } from './pages/client/ClientHome';
import { NewApplication } from './pages/client/NewApplication';
import { StatusTracking } from './pages/client/StatusTracking';
import { ApplicationHistory } from './pages/client/ApplicationHistory';
import { Profile as ClientProfile } from './pages/client/Profile';

// Officer Pages
import { OfficerHome } from './pages/officer/OfficerHome';
import { OfficerApplications } from './pages/officer/OfficerApplications';
import { PlanReview } from './pages/officer/PlanReview';
import { OfficerApplicants } from './pages/officer/OfficerApplicants';
import { OfficerProfile } from './pages/officer/OfficerProfile';



// Public Verification Page
import { VerifyCertificate } from './pages/public/VerifyCertificate';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Public Permit Verification Route */}
        <Route element={<AppLayout />}>
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route path="/verify/:applicationNo" element={<VerifyCertificate />} />

          {/* Client Routes */}
          <Route
            path="/client"
            element={
              <RoleRoute allowedRoles={['client']}>
                <ClientHome />
              </RoleRoute>
            }
          />
          <Route
            path="/client/apply"
            element={
              <RoleRoute allowedRoles={['client']}>
                <NewApplication />
              </RoleRoute>
            }
          />
          <Route
            path="/client/status"
            element={
              <RoleRoute allowedRoles={['client']}>
                <StatusTracking />
              </RoleRoute>
            }
          />
          <Route
            path="/client/history"
            element={
              <RoleRoute allowedRoles={['client']}>
                <ApplicationHistory />
              </RoleRoute>
            }
          />
          <Route
            path="/client/profile"
            element={
              <RoleRoute allowedRoles={['client']}>
                <ClientProfile />
              </RoleRoute>
            }
          />

          {/* Officer Routes */}
          <Route
            path="/officer"
            element={
              <RoleRoute allowedRoles={['officer']}>
                <OfficerHome />
              </RoleRoute>
            }
          />
          <Route
            path="/officer/applications"
            element={
              <RoleRoute allowedRoles={['officer']}>
                <OfficerApplications />
              </RoleRoute>
            }
          />
          <Route
            path="/officer/review/:id"
            element={
              <RoleRoute allowedRoles={['officer']}>
                <PlanReview />
              </RoleRoute>
            }
          />
          <Route
            path="/officer/applicants"
            element={
              <RoleRoute allowedRoles={['officer']}>
                <OfficerApplicants />
              </RoleRoute>
            }
          />
          <Route
            path="/officer/profile"
            element={
              <RoleRoute allowedRoles={['officer']}>
                <OfficerProfile />
              </RoleRoute>
            }
          />


        </Route>

        {/* Root Redirect to Client Portal */}
        <Route path="/" element={<Navigate to="/client" replace />} />
        <Route path="*" element={<Navigate to="/client" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
