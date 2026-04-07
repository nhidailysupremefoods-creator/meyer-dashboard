'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Registration } from '@/types';

interface RegistrationTabProps {
  registrations: Registration[];
  onUpdate: () => Promise<void>;
}

export default function RegistrationTab({ registrations, onUpdate }: RegistrationTabProps) {
  const { approveRegistration, rejectRegistration, loading, error } = useAdmin();
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<Record<string, string>>({});

  const handleApprove = async (email: string) => {
    setProcessing(email);
    try {
      const success = await approveRegistration(email);
      if (success) {
        setStatusMessage({
          ...statusMessage,
          [email]: 'Genehmigt ✓',
        });
        setTimeout(() => {
          setStatusMessage((prev) => {
            const next = { ...prev };
            delete next[email];
            return next;
          });
        }, 2000);
        await onUpdate();
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (email: string) => {
    if (!window.confirm(`Möchten Sie die Registrierung für ${email} ablehnen?`)) {
      return;
    }

    setProcessing(email);
    try {
      const success = await rejectRegistration(email);
      if (success) {
        setStatusMessage({
          ...statusMessage,
          [email]: 'Abgelehnt ✓',
        });
        setTimeout(() => {
          setStatusMessage((prev) => {
            const next = { ...prev };
            delete next[email];
            return next;
          });
        }, 2000);
        await onUpdate();
      }
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Ausstehend',
      },
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'Genehmigt',
      },
      rejected: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: 'Abgelehnt',
      },
    };
    const style = statusMap[status] || statusMap.pending;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const pendingRegistrations = registrations.filter((r) => r.status === 'pending');

  return (
    <div className="bg-white rounded-lg shadow">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {pendingRegistrations.length === 0 && registrations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Keine Registrierungen vorhanden</p>
        </div>
      ) : (
        <>
          {pendingRegistrations.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
                <h3 className="font-semibold text-yellow-900">
                  Ausstehende Registrierungen ({pendingRegistrations.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        E-Mail
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Angefordert
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingRegistrations.map((reg) => (
                      <tr key={reg.email} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {reg.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(reg.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {reg.requested_at
                            ? new Date(reg.requested_at).toLocaleDateString('de-DE')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          {statusMessage[reg.email] ? (
                            <span className="text-green-600 font-semibold">
                              {statusMessage[reg.email]}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApprove(reg.email)}
                                disabled={processing === reg.email || loading}
                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400"
                              >
                                ✓ Genehmigen
                              </button>
                              <button
                                onClick={() => handleReject(reg.email)}
                                disabled={processing === reg.email || loading}
                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400"
                              >
                                ✕ Ablehnen
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {registrations.filter((r) => r.status !== 'pending').length > 0 && (
            <div className="border-t border-gray-200">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  Verarbeitete Registrierungen
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        E-Mail
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Angefordert
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {registrations
                      .filter((r) => r.status !== 'pending')
                      .map((reg) => (
                        <tr key={reg.email} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {reg.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(reg.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {reg.requested_at
                              ? new Date(reg.requested_at).toLocaleDateString('de-DE')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
