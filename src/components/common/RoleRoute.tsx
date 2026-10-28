import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../../services/store';
import { UserRole } from '../../types';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, isAuthenticated } = useCurrentUser();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    if (currentUser.role === 'officer') {
      return <Navigate to="/officer" replace />;
    }
    return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
};
