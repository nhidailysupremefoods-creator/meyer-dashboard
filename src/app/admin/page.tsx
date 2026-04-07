'use client';

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useRouter } from 'next/navigation';
import CustomerTab from '@/components/admin/CustomerTab';
import UserTab from '@/components/admin/UserTab';
import RegistrationTab from '@/components/admin/RegistrationTab';
import ReleaseTab from '@/components/admin/ReleaseTab';
import AuditTab from '@/components/admin/AuditTab';
import SystemTab from '@/components/admin/SystemTab';

type TabType = 'customers' | 'users' | 'registrations' | 'releases' | 'audit' | 'system';

export default function AdminPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuthContext();
  const {
    customers,
    users,
    registrations,
    audit,
    releases,
    loading,
    error,
    init,
    clearError,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<TabType>('customers');

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/');
    }
  }, [authLoading, role, router]);

  // Load admin data
  useEffect(() => {
    init();
  }, [init]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">Kein Admin-Zugriff</p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:underline"
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin-Bereich</h1>
          <p className="text-gray-600 mt-1">Verwalten Sie Mandanten, Benutzer und Einstellungen</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-800">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800 font-semibold"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {[
              { id: 'customers', label: 'Mandanten' },
              { id: 'users', label: 'Benutzer' },
              { id: 'registrations', label: 'Registrierungen' },
              { id: 'releases', label: 'Monatsfreigabe' },
              { id: 'audit', label: 'Audit-Log' },
              { id: 'system', label: 'System' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'customers' && <CustomerTab customers={customers} onUpdate={init} />}
        {activeTab === 'users' && <UserTab users={users} customers={customers} onUpdate={init} />}
        {activeTab === 'registrations' && <RegistrationTab registrations={registrations} onUpdate={init} />}
        {activeTab === 'releases' && <ReleaseTab customers={customers} releases={releases} onUpdate={init} />}
        {activeTab === 'audit' && <AuditTab audit={audit} />}
        {activeTab === 'system' && <SystemTab onUpdate={init} />}
      </div>
    </div>
  );
}
