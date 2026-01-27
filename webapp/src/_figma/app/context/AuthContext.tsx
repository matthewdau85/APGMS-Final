import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { UserRole } from '../types';

interface AuthContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canLodge: boolean;
  canVerify: boolean;
  canExport: boolean;
  isReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<UserRole | null>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('apgms-user-role');
    return (saved as UserRole) || null;
  });

  const isAuthenticated = role !== null;

  // Persist role to localStorage
  useEffect(() => {
    if (role) {
      localStorage.setItem('apgms-user-role', role);
    } else {
      localStorage.removeItem('apgms-user-role');
    }
  }, [role]);

  const setRole = (newRole: UserRole | null) => {
    setRoleState(newRole);
  };

  const logout = () => {
    setRoleState(null);
  };

  /**
   * RBAC Matrix:
   * - Operator: Create/edit operational objects; cannot publish policies; cannot manage connectors/orgs
   * - Admin: Full control (publish policies, approve/reject, manage connectors, verify packs)
   * - Auditor: Read-only EXCEPT verify evidence packs and export/download
   * - Regulator: Strict read-only, can download evidence, cannot access Settings/reset tools
   */
  const canEdit = role === 'Admin' || role === 'Operator';
  const canCreate = role === 'Admin' || role === 'Operator';
  const canDelete = role === 'Admin';
  const canApprove = role === 'Admin';
  const canLodge = role === 'Admin' || role === 'Operator';
  const canVerify = role === 'Auditor' || role === 'Admin' || role === 'Regulator';
  const canExport = true; // All roles can export/download
  const isReadOnly = role === 'Auditor' || role === 'Regulator';

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        isAuthenticated,
        logout,
        canEdit,
        canCreate,
        canDelete,
        canApprove,
        canLodge,
        canVerify,
        canExport,
        isReadOnly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
