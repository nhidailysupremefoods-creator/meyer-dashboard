'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { HealthCheckResponse } from '@/types';

interface SystemTabProps {
  onUpdate: () => Promise<void>;
}

export default function SystemTab({ onUpdate }: SystemTabProps) {
  const { checkHealth, clearCache, triggerRebuild, loading, error } = useAdmin();
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const result = await checkHealth();
      setHealth(result);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Möchten Sie den Cache wirklich löschen?')) {
      return;
    }

    setClearing(true);
    try {
      const success = await clearCache();
      if (success) {
        setMessages({
          ...messages,
          cache: 'Cache geleert ✓',
        });
        setTimeout(() => {
          setMessages((prev) => {
            const next = { ...prev };
            delete next.cache;
            return next;
          });
        }, 3000);
        await loadHealth();
      }
    } finally {
      setClearing(false);
    }
  };

  const handleRebuild = async () => {
    if (!window.confirm('Möchten Sie die Advisory-Tabelle wirklich neu aufbauen?')) {
      return;
    }

    setRebuilding(true);
    try {
      const success = await triggerRebuild();
      if (success) {
        setMessages({
          ...messages,
          rebuild: 'Rebuild in Bearbeitung... ✓',
        });
        setTimeout(() => {
          setMessages((prev) => {
            const next = { ...prev };
            delete next.rebuild;
            return next;
          });
        }, 5000);
        await loadHealth();
        await onUpdate();
      }
    } finally {
      setRebuilding(false);
    }
  };

  // Load health on mount
  useEffect(() => {
    loadHealth();
  }, []);

  const getStatusIcon = (status: string) => {
    if (status === 'OK' || status === 'healthy') {
      return (
        <span className="text-green-500 font-bold text-lg">●</span>
      );
    } else if (status === 'WARN' || status === 'warning') {
      return (
        <span className="text-yellow-500 font-bold text-lg">●</span>
      );
    } else {
      return (
        <span className="text-red-500 font-bold text-lg">●</span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Health Check */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">System-Health</h3>
          <button
            onClick={loadHealth}
            disabled={healthLoading || loading}
            className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-400"
          >
            <span className={`mr-2 ${healthLoading ? 'animate-spin' : ''}`}>↻</span>
            Aktualisieren
          </button>
        </div>

        {healthLoading && !health ? (
          <div className="p-6 text-center text-gray-500">
            Health Check lädt...
          </div>
        ) : health?.status ? (
          <div className="p-6 space-y-4">
            {/* BigQuery Connection */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {getStatusIcon(health.status.bigquery)}
                <div>
                  <p className="font-medium text-gray-900">BigQuery-Verbindung</p>
                  <p className="text-sm text-gray-600">{health.status.bigquery}</p>
                </div>
              </div>
            </div>

            {/* Finance Table */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {getStatusIcon(health.status.finance_table)}
                <div>
                  <p className="font-medium text-gray-900">Finance-Tabelle</p>
                  <p className="text-sm text-gray-600">{health.status.finance_table}</p>
                </div>
              </div>
            </div>

            {/* Reporting Views */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {getStatusIcon(health.status.reporting_views)}
                <div>
                  <p className="font-medium text-gray-900">Reporting-Views</p>
                  <p className="text-sm text-gray-600">{health.status.reporting_views}</p>
                </div>
              </div>
            </div>

            {/* Cache */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {getStatusIcon(health.status.cache)}
                <div>
                  <p className="font-medium text-gray-900">Cache</p>
                  <p className="text-sm text-gray-600">{health.status.cache}</p>
                </div>
              </div>
            </div>

            {/* Active Customers */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <span className="text-blue-500 font-bold text-lg">●</span>
                <div>
                  <p className="font-medium text-gray-900">Aktive Mandanten</p>
                  <p className="text-sm text-gray-600">{health.status.customers}</p>
                </div>
              </div>
            </div>

            {/* Dashboard Version */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center space-x-3">
                <span className="text-purple-500 font-bold text-lg">●</span>
                <div>
                  <p className="font-medium text-gray-900">Dashboard-Version</p>
                  <p className="text-sm text-gray-600">{health.status.dashboard_version}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            Keine Health-Daten verfügbar
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clear Cache Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Cache leeren</h3>
          <p className="text-sm text-gray-600 mb-4">
            Löscht alle gecachten Daten und zwingt ein erneutes Laden aus der Datenbank.
          </p>
          {messages.cache ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 font-semibold">
              {messages.cache}
            </div>
          ) : (
            <button
              onClick={handleClearCache}
              disabled={clearing || loading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md disabled:bg-gray-400"
            >
              {clearing ? 'Wird gelöscht...' : 'Cache leeren'}
            </button>
          )}
        </div>

        {/* Rebuild Advisory Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Advisory neu aufbauen
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Erstellt die finance_monthly_base Tabelle aus den rohen Daten neu.
          </p>
          {messages.rebuild ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 font-semibold">
              {messages.rebuild}
            </div>
          ) : (
            <button
              onClick={handleRebuild}
              disabled={rebuilding || loading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:bg-gray-400"
            >
              {rebuilding ? 'Wird aufgebaut...' : 'Advisory Rebuild'}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Hinweise
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Cache-Leerung kann einige Sekunden dauern</li>
          <li>Advisory-Rebuild sollte nur bei Problemen durchgeführt werden</li>
          <li>Health Check wird automatisch alle 5 Minuten aktualisiert</li>
        </ul>
      </div>
    </div>
  );
}
