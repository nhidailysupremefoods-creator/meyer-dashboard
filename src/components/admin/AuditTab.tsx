'use client';

import { useState, useMemo } from 'react';
import { AuditEntry } from '@/types';

interface AuditTabProps {
  audit: AuditEntry[];
}

export default function AuditTab({ audit }: AuditTabProps) {
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'asc' | 'desc'>('desc');

  // Get unique event types
  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    audit.forEach((entry) => {
      if (entry.event_type) {
        types.add(entry.event_type);
      }
    });
    return Array.from(types).sort();
  }, [audit]);

  // Filter and sort audit entries
  const filtered = useMemo(() => {
    let result = [...audit];

    // Date filter
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter((entry) => {
        const ts = new Date(entry.event_timestamp);
        return ts >= from;
      });
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((entry) => {
        const ts = new Date(entry.event_timestamp);
        return ts <= to;
      });
    }

    // Event type filter
    if (filterEventType) {
      result = result.filter((entry) => entry.event_type === filterEventType);
    }

    // Sort
    result.sort((a, b) => {
      const aTime = new Date(a.event_timestamp).getTime();
      const bTime = new Date(b.event_timestamp).getTime();
      return sortBy === 'desc' ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [audit, filterDateFrom, filterDateTo, filterEventType, sortBy]);

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CUSTOMER_CREATED: 'Mandant erstellt',
      CUSTOMER_UPDATED: 'Mandant aktualisiert',
      CUSTOMER_INDUSTRY_CHANGED: 'Branche geändert',
      USER_CREATED: 'Benutzer erstellt',
      USER_UPDATED: 'Benutzer aktualisiert',
      USER_DELETED: 'Benutzer gelöscht',
      REGISTRATION_APPROVED: 'Registrierung genehmigt',
      REGISTRATION_REJECTED: 'Registrierung abgelehnt',
      MONTH_RELEASED: 'Monat freigegeben',
      MONTH_UNRELEASED: 'Monat gesperrt',
      CACHE_CLEARED: 'Cache geleert',
      ADVISORY_REBUILT: 'Advisory neu erstellt',
    };
    return labels[type] || type;
  };

  const getEventTypeBadgeColor = (type: string) => {
    if (type.includes('CUSTOMER')) return 'bg-blue-100 text-blue-800';
    if (type.includes('USER')) return 'bg-purple-100 text-purple-800';
    if (type.includes('REGISTRATION')) return 'bg-orange-100 text-orange-800';
    if (type.includes('MONTH')) return 'bg-green-100 text-green-800';
    if (type.includes('CACHE') || type.includes('ADVISORY')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Von
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bis
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ereignistyp
            </label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">-- Alle --</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {getEventTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sortierung
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'asc' | 'desc')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="desc">Neueste zuerst</option>
              <option value="asc">Älteste zuerst</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zeitstempel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ereignistyp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Benutzer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mandant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((entry, idx) => (
                <tr key={`${entry.event_timestamp}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(entry.event_timestamp).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEventTypeBadgeColor(
                        entry.event_type
                      )}`}
                    >
                      {getEventTypeLabel(entry.event_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {entry.user_email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entry.customer_id || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    <span className="line-clamp-2" title={entry.description}>
                      {entry.description || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Keine Einträge mit den aktuellen Filtern
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            {filtered.length} von {audit.length} Einträgen angezeigt
          </div>
        )}
      </div>
    </div>
  );
}
