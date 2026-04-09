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

  const [pageData, setPageData] = useState<Record<PageNum, any>>({} as any);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initialize auth ──
  useEffect(() => {
    const data = api.getAuthData();
    if (data) {
      setAuthData(data);
      if (data.customers && data.customers.length > 0) {
        setSelectedCustomer(data.customers[0]);
      } else if (data.role === 'admin') {
        fetch('/api/dashboard/customers')
          .then(res => res.json())
          .then(async (resp) => {
            if (resp.customers && resp.customers.length > 0) {
              const customerIds = resp.customers.map((c: any) => c.customer_id || c);
              setAuthData(prev => prev ? { ...prev, customers: customerIds } : prev);
              setSelectedCustomer(customerIds[0]);
            } else {
              const knownIds = [
                'INDUSTRIE_GAMMA',
                'MUSTERMANN_TECHNIK',
                'SCHMIDT_ANLAGENBAU',
                'WEBER_HAUSTECHNIK',
              ];
              const validIds: string[] = [];
              await Promise.all(
                knownIds.map(async (cid) => {
                  try {
                    const r = await fetch(`/api/dashboard/periods?customer=${cid}`);
                    const d = await r.json();
                    if (d.periods && d.periods.length > 0) {
                      validIds.push(cid);
                    }
                  } catch { /* skip */ }
                })
              );
              if (validIds.length > 0) {
                validIds.sort();
                setAuthData(prev => prev ? { ...prev, customers: validIds } : prev);
                setSelectedCustomer(validIds[0]);
              }
            }
          })
          .catch(err => console.error('Error loading customers:', err));
      }
    }
  }, []);

  // ── Load periods when customer changes ──
  useEffect(() => {
    if (!selectedCustomer) return;
    const loadPeriods = async () => {
      try {
        setLoadingPeriods(true);
        setError(null);
        const response = await api.fetchPeriods(selectedCustomer);
        if (response.periods) {
          setPeriods(response.periods.map((p: any) => ({
            period: p.period || p.month_id,
            label: p.label || p.month_label_short || p.month_id,
          })));
          if ((response as any).industry_segment) {
            setIndustrySegment((response as any).industry_segment || '');
          }
          if (response.periods.length > 0) {
            setSelectedPeriod((response.periods[0] as any).period || (response.periods[0] as any).month_id);
          }
        }
      } catch {
        setError('Perioden konnten nicht geladen werden');
      } finally {
        setLoadingPeriods(false);
      }
    };
    loadPeriods();
  }, [selectedCustomer]);

  // ── Load page data ──
  const loadPageData = useCallback(
    async (page: PageNum, customer: string, period: string) => {
      if (!customer || !period) return;
      setLoadingPage(true);
      setError(null);
      try {
        const response = await api.fetchPageData(page, customer, period);
        if (response && !response.error) {
          setPageData((prev) => ({ ...prev, [page]: response }));
        } else {
          setError((response as any).error || `Seite ${page} konnte nicht geladen werden`);
        }
      } catch {
        setError(`Seite ${page} konnte nicht geladen werden`);
      } finally {
        setLoadingPage(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedCustomer && selectedPeriod) {
      setPageData({} as any);
      loadPageData(currentPage, selectedCustomer, selectedPeriod);
    }
  }, [selectedCustomer, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedCustomer && selectedPeriod) {
      loadPageData(currentPage, selectedCustomer, selectedPeriod);
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePdfExport = () => {
    window.print();
  };

  if (!authData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderBottomColor: 'var(--copper)' }}
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
    <div className="space-y-5">
      {/* ── Controls Row (Customer, Period, Industry, PDF) ── */}
      <div
        className="card flex flex-col sm:flex-row gap-4 items-start sm:items-end print:hidden"
        style={{ padding: '1rem 1.25rem' }}
      >
        {/* Customer */}
        <div className="flex-1 w-full sm:w-auto">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Mandant
          </label>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full"
            disabled={loadingPeriods}
            style={{ fontSize: '0.85rem' }}
          >
            {authData.customers.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div className="flex-1 w-full sm:w-auto">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Berichtsperiode
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full"
            disabled={periods.length === 0 || loadingPeriods}
            style={{ fontSize: '0.85rem' }}
          >
            {periods.map((p) => (
              <option key={p.period} value={p.period}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Industry Badge */}
        {industrySegment && (
          <div className="flex-shrink-0">
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Branche
            </label>
            <span
              className="inline-block px-3 py-2 rounded text-xs font-semibold"
              style={{
                backgroundColor: 'rgba(27, 42, 74, 0.06)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            >
              {industrySegment.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* PDF Export */}
        <div className="flex-shrink-0">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'transparent' }}
          >
            Export
          </label>
          <button
            onClick={handlePdfExport}
            className="btn-secondary"
            style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            title="Als PDF exportieren"
          >
            PDF Export
          </button>
        </div>
      </div>

      {/* ── Error Alert ── */}
      {error && (
        <div
          className="p-4 rounded-lg border text-sm flex items-start gap-3 print:hidden"
          style={{
            background: 'rgba(196, 56, 48, 0.06)',
            color: 'var(--danger)',
            borderColor: 'rgba(196, 56, 48, 0.2)',
          }}
        >
          <span className="text-lg">&#9888;&#6503;</span>
          <div>
            <strong>Fehler:</strong> {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs font-bold"
            style={{ color: 'var(--danger)' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Page Tabs (Original Style: numbered, green underline active) ── */}
      <div
        className="flex gap-0 print:hidden"
        style={{
          borderBottom: '2px solid var(--border-color)',
        }}
      >
        {([1, 2, 3, 4] as PageNum[]).map((num) => {
          const isActive = currentPage === num;
          return (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className="relative px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--success)' : '2.5px solid transparent',
                marginBottom: '-2px',
              }}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-1.5"
                style={{
                  backgroundColor: isActive ? 'var(--navy)' : 'rgba(107, 122, 144, 0.15)',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.65rem',
                }}
              >
                {num}
              </span>
              {PAGE_TITLES[num]}
            </button>
          );
        })}
      </div>

      {/* ── Page Content ── */}
      {loadingPage ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4"
              style={{ borderBottomColor: 'var(--copper)' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {PAGE_TITLES[currentPage]} wird geladen...
            </p>
          </div>
        </div>
      ) : currentPageData ? (
        <div>{renderPage()}</div>
      ) : !loadingPage && selectedCustomer && selectedPeriod ? (
        <div
          className="text-center py-16"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p className="font-medium">Keine Daten verfügbar</p>
          <p className="text-sm mt-2">
            Für {selectedCustomer.replace(/_/g, ' ')} / {selectedPeriod} wurden keine Daten gefunden
          </p>
          <button
            onClick={() => loadPageData(currentPage, selectedCustomer, selectedPeriod)}
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
