'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { AuthData } from '@/types';
import Page1Gesamtlage from '@/components/dashboard/Page1Gesamtlage';
import Page2Vertragsanalyse from '@/components/dashboard/Page2Vertragsanalyse';
import Page3Liquiditaet from '@/components/dashboard/Page3Liquiditaet';
import Page4Massnahmen from '@/components/dashboard/Page4Massnahmen';

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
  const [periods, setPeriods] = useState<Array<{ period: string; label: string }>>([]);
  const [industrySegment, setIndustrySegment] = useState<string>('');
  const [customerList, setCustomerList] = useState<Array<{ customer_id: string; customer_name: string; is_active: boolean }>>([]);

  // Store full API response per page (not just response.data)
  const [pageData, setPageData] = useState<Record<PageNum, any>>({} as any);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initialize auth ───────────────────────────────────────────────────────
  useEffect(() => {
    const data = api.getAuthData();
    if (data) {
      setAuthData(data);
      if (data.customers && data.customers.length > 0) {
        // Non-admin: customers list comes from login response (customer IDs)
        const list = data.customers.map((id: string) => ({
          customer_id: id,
          customer_name: id.replace(/_/g, ' '),
          is_active: true,
        }));
        setCustomerList(list);
        setSelectedCustomer(data.customers[0]);
      } else {
        // Admin or GLOBAL user: customers[] is empty, fetch full list from API
        const tok = api.getToken();
        if (tok) {
          fetch('/api/dashboard/customers?action=customers&token=' + tok)
            .then((r) => r.json())
            .then((d) => {
              if (d.customers && Array.isArray(d.customers) && d.customers.length > 0) {
                const active = d.customers.filter((c: any) => c.is_active !== false);
                setCustomerList(active);
                if (active.length > 0) {
                  setSelectedCustomer(active[0].customer_id);
                }
              }
            })
            .catch(() => {});
        }
      }
    }
  }, []);

  // ── Load periods when customer changes ────────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) return;

    const loadPeriods = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.fetchPeriods(selectedCustomer);
        if (response.success && response.periods) {
          setPeriods(response.periods);
          if ((response as any).industrySegment || (response as any).industry_segment) {
            setIndustrySegment(
              (response as any).industry_segment || (response as any).industrySegment || ''
            );
          }
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

  // ── Load page data when page / period changes ─────────────────────────────
  const loadPageData = useCallback(
    async (page: PageNum, customer: string, period: string) => {
      if (!customer || !period) return;
      setLoading(true);
      setError(null);
      try {
        const response = await api.fetchPageData(page, customer, period);
        if (response.success) {
          // Store the FULL response so page components can access all top-level keys
          setPageData((prev) => ({ ...prev, [page]: response }));
        } else {
          setError((response as any).error || `Seite ${page} konnte nicht geladen werden`);
        }
      } catch {
        setError(`Seite ${page} konnte nicht geladen werden`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedCustomer && selectedPeriod) {
      // Invalidate cached data when customer/period changes
      setPageData({} as any);
      loadPageData(currentPage, selectedCustomer, selectedPeriod);
    }
  }, [selectedCustomer, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedCustomer && selectedPeriod) {
      loadPageData(currentPage, selectedCustomer, selectedPeriod);
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderBottomColor: 'var(--primary)' }}
          />
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            Wird geladen...
          </p>
        </div>
      </div>
    );
  }

  const currentPageData = pageData[currentPage];

  const renderPage = () => {
    if (!currentPageData) return null;
    switch (currentPage) {
      case 1:
        return <Page1Gesamtlage data={currentPageData} />;
      case 2:
        return <Page2Vertragsanalyse data={currentPageData} />;
      case 3:
        return <Page3Liquiditaet data={currentPageData} />;
      case 4:
        return (
          <Page4Massnahmen
            data={currentPageData}
            customer={selectedCustomer}
            period={selectedPeriod}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Controls Bar ──────────────────────────────────────────────────── */}
      <div className="card flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Customer Selector */}
        <div className="flex-1 w-full">
          <label
            className="block text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Mandant
          </label>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full"
          >
            {customerList.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.customer_name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Selector */}
        <div className="flex-1 w-full">
          <label
            className="block text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Berichtsperiode
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

        {/* Industry Segment badge */}
        {industrySegment && (
          <div className="flex-shrink-0">
            <div
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Branche
            </div>
            <span
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: 'rgba(43,108,176,0.12)',
                color: 'var(--accent)',
              }}
            >
              {industrySegment.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>

      {/* ── Error Alert ─────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="p-4 rounded-xl border text-sm flex items-start gap-3"
          style={{
            background: 'rgb(254,242,242)',
            color: 'var(--danger)',
            borderColor: 'rgb(254,205,211)',
          }}
        >
          <span className="text-lg">⚠️</span>
          <div>
            <strong>Fehler:</strong> {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs"
            style={{ color: 'var(--danger)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Page Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([1, 2, 3, 4] as PageNum[]).map((num) => (
          <button
            key={num}
            onClick={() => setCurrentPage(num)}
            className="px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap"
            style={
              currentPage === num
                ? {
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(26,54,93,0.25)',
                  }
                : {
                    backgroundColor: 'var(--background-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                  }
            }
          >
            <span className="opacity-60 mr-1">{num}</span>
            {PAGE_TITLES[num]}
          </button>
        ))}
      </div>

      {/* ── Page Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
              style={{ borderBottomColor: 'var(--primary)' }}
            />
            <p style={{ color: 'var(--text-secondary)' }}>
              {PAGE_TITLES[currentPage]} wird geladen...
            </p>
          </div>
        </div>
      ) : currentPageData ? (
        <div>
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                Seite {currentPage}: {PAGE_TITLES[currentPage]}
              </h2>
              {selectedPeriod && (
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {selectedCustomer} · {selectedPeriod.replace(/_/g, '/')}
                </p>
              )}
            </div>
            <button
              onClick={() =>
                loadPageData(currentPage, selectedCustomer, selectedPeriod)
              }
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border-color) ',
                color: 'var(--text-secondary)',
              }}
              title="Daten aktualisieren"
            >
              �� Aktualisieren
            </button>
          </div>
          {renderPage()}
        </div>
      ) : !loading && selectedCustomer && selectedPeriod ? (
        <div
          className="text-center py-16"
          style={{ color: 'var(--text-secondary)' }}
        >
          <div className="text-4xl mb-4">📎</div>
          <p className="font-medium">Keine Daten verfügbar</r>
          <p className="text-sm mt-2">
            Für {selectedCustomer} / {selectedPeriod} wurden keine Daten gefunden
          </p>
          <button
            onClick={() =>
              loadPageData(currentPage, selectedCustomer, selectedPeriod)
            }
            className="btn-primary mt-4 px-4 py-2 rounded-lg text-sm"
          >
            Erneut versuchen
          </button>
        </div>
      ) : (
        <div
          className="text-center py-16"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p>Bitte Mandant und Periode auswählen</p>
        </div>
      )}
    </div>
  );
}
