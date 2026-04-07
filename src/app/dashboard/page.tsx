'use client'; 

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AuthData, PageDataResponse } from '@/types';

type PageNum = 1 | 2 | 3 | 4;

const PAGE_TITLES: Record<PageNum, string> = {
  1: 'Gesamtlage',
  2: 'Vertragsanalyse',
  3: 'Liquiditätsstabilität',
  4: 'Maßnahmen & Benchmarks',
};

export default function DashboardPage() {
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [currentPage, setCurrentPage] = useState<PageNum>(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [periods, setPeriods] = useState<Array<{period: string; label: string}>>([]);
  const [pageData, setPageData] = useState<PageDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth and load data
  useEffect(() => {
    const data = api.getAuthData();
    if (data) {
      setAuthData(data);
      if (data.customers && data.customers.length > 0) {
        setSelectedCustomer(data.customers[0]);
      }
    }
  }, []);

  // Load periods when customer changes
  useEffect(() => {
    if (!selectedCustomer) return;

    const loadPeriods = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.fetchPeriods(selectedCustomer);

        if (response.success && response.periods) {
          setPeriods(response.periods);
          if (response.periods.length > 0) {
            setSelectedPeriod(response.periods[0].period);
          }
        }
      } catch {
        setError('Perioden konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };

    loadPeriods();
  }, [selectedCustomer]);

  // Load page data when period changes
  useEffect(() => {
    if (!selectedCustomer || !selectedPeriod) return;

    const loadPageData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.fetchPageData(currentPage, selectedCustomer, selectedPeriod);

        if (response.success) {
          setPageData(response);
        }
      } catch {
        setError(`Seite ${currentPage} konnte nicht geladen werden`);
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [selectedCustomer, selectedPeriod, currentPage]);

  if (!authData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{borderBottomColor: 'var(--primary)'}} />
          <p className="mt-4" style={{color: 'var(--text-secondary)'}}>Wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="card flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
          {/* Customer Dropdown */}
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Kunde
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full"
            >
              {authData.customers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </div>

          {/* Period Dropdown */}
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Periode
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full"
              disabled={periods.length === 0}
            >
              {periods.map((p) => (
                <option key={p.period} value={p.period}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg border text-sm" style={{background: 'rgb(254, 242, 242)', color: 'var(--danger)', borderColor: 'rgb(254, 205, 211)'}}>
          {error}
        </div>
      )}

      {/* Page Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(Object.keys(PAGE_TITLES) as unknown as PageNum[]).map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setCurrentPage(pageNum)}
            className="px-4 py-2 rounded-lg font-medium transition whitespace-nowrap"
            style={currentPage === pageNum
              ? {backgroundColor: 'var(--primary)', color: 'white'}
              : {backgroundColor: 'var(--background-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)'}
            }
          >
            Seite {pageNum}: {PAGE_TITLES[pageNum]}
          </button>
        ))}
      </div>

      {/* Page Content */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{borderBottomColor: 'var(--primary)', margin: '0 auto 1rem'}} />
              <p style={{color: 'var(--text-secondary)'}}>Daten werden geladen...</p>
            </div>
          </div>
        ) : pageData ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">
              {PAGE_TITLES[currentPage]}
            </h2>

            {/* Data Display (Placeholder) */}
            <div className="rounded-lg p-4 border" style={{backgroundColor: 'var(--background)', borderColor: 'var(--border-color)'}}>
              <pre className="text-xs overflow-auto max-h-96" style={{color: 'var(--text-secondary)'}}>
                {JSON.stringify(pageData, null, 2)}
              </pre>
            </div>

            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
              Kunde: <strong>{selectedCustomer}</strong> | Periode: <strong>{selectedPeriod}</strong>
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p style={{color: 'var(--text-secondary)'}}>Keine Daten verfügbar</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="card" style={{backgroundColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)'}}>
        <div className="flex gap-3">
          <div className="text-lg flex-shrink-0">ℹ️</div>
          <div>
            <h3 className="font-medium" style={{color: 'rgb(30, 58, 138)'}}>Dashboard wird migriert</h3>
            <p className="text-sm mt-1" style={{color: 'rgb(59, 90, 177)'}}>
              Die vollständigen Seiten mit Grafiken und interaktiven Elementen werden noch eingebunden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
