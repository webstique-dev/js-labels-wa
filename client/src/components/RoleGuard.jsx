import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleGuard({ module, children }) {
  const { permissions, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const hasViewAccess = permissions[module]?.includes('view');

  if (!hasViewAccess) {
    return (
      <Navigate
        to="/dashboard"
        state={{ deniedMessage: "You don't have access to this page" }}
        replace
      />
    );
  }

  return children;
}
