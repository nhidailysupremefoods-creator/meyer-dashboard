'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Cache all 4 pages keyed by "customer_period_page"
  const [pageData, setPageData] = useState<Record<string, any>>({});
  const [loadingPages, setLoadingPages] = useState<Set<PageNum>>(new Set());
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current load to avoid stale updates
  const loadIdRef = useRef(0);

  // Helper: cache key for page data
  const pageKey = (page: PageNum, cust: string, per: string) => `${cust}_${per}_${page}`;

  // -- Initialize auth (no more 4-customer validation loop) --
  useEffect(() => {
    const data = api.getAuthData();
    if (data) {
      setAuthData(data);
      if (data.customers && data.customers.length > 0) {
        setSelectedCustomer(data.customers[0]);
      } else if (data.role === 'admin') {
        // Admin without customer list: use hardcoded fallback immediately
        const knownIds = [
          'INDUSTRIE_GAMMA',
          'MUSTERMANN_TECHNIK',
          'SCHMIDT_ANLAGENBAU',
          'WEBER_HAUSTECHNIK',
        ];
        setAuthData(prev => prev ? { ...prev, customers: knownIds } : prev);
        setSelectedCustomer(knownIds[0]);
        // Also try loading real list in background (non-blocking)
        fetch('/api/dashboard/customers')
          .then(res => res.json())
          .then(resp => {
            if (resp.customers && resp.customers.length > 0) {
              const customerIds = resp.customers.map((c: any) => c.customer_id || c);
              setAuthData(prev => prev ? { ...prev, customers: customerIds } : prev);
            }
          })
          .catch(() => { /* fallback already set */ });
      }
    }
  }, []);

  // -- Load periods when customer changes --
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

  // -- Load a single page (with retry) --
  const loadSinglePage = useCallback(
    async (page: PageNum, customer: string, period: string, loadId: number, retryCount = 0) => {
      if (!customer || !period) return;

      try {
        const response = await api.fetchPageData(page, customer, period);
        // Abort if a newer load started
        if (loadIdRef.current !== loadId) return;

        if (response && !response.error) {
          const key = pageKey(page, customer, period);
          setPageData(prev => ({ ...prev, [key]: response }));
        } else if ((response as any).retryable && retryCount < 2) {
          setTimeout(() => loadSinglePage(page, customer, period, loadId, retryCount + 1), 1500);
          return; // don't clear loading state yet
        }
      } catch {
        if (retryCount < 1) {
          setTimeout(() => loadSinglePage(page, customer, period, loadId, retryCount + 1), 1500);
          return;
        }
      }

      // Remove from loading set
      setLoadingPages(prev => {
        const next = new Set(prev);
        next.delete(page);
        return next;
      });
    },
    []
  );

  // -- Load ALL 4 pages in parallel when customer+period change --
  useEffect(() => {
    if (!selectedCustomer || !selectedPeriod) return;

    const loadId = ++loadIdRef.current;
    const pagesToLoad: PageNum[] = [];

    // Check which pages need loading (not already cached)
    for (const p of [1, 2, 3, 4] as PageNum[]) {
      const key = pageKey(p, selectedCustomer, selectedPeriod);
      if (!pageData[key]) {
        pagesToLoad.push(p);
      }
    }

    if (pagesToLoad.length === 0) return;

    // Mark all as loading
    setLoadingPages(new Set(pagesToLoad));
    setError(null);

    // Fire all requests in parallel
    for (const p of pagesToLoad) {
      loadSinglePage(p, selectedCustomer, selectedPeriod, loadId);
    }
  }, [selectedCustomer, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- When switching tabs: load if not cached --
  useEffect(() => {
    if (!selectedCustomer || !selectedPeriod) return;
    const key = pageKey(currentPage, selectedCustomer, selectedPeriod);
    if (!pageData[key] && !loadingPages.has(currentPage)) {
      setLoadingPages(prev => new Set(prev).add(currentPage));
      loadSinglePage(currentPage, selectedCustomer, selectedPeriod, loadIdRef.current);
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

  const currentKey = pageKey(currentPage, selectedCustomer, selectedPeriod);
  const currentPageData = pageData[currentKey];
  const isCurrentLoading = loadingPages.has(currentPage);

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

  // Show which pages are loaded (green dots)
  const getPageLoadStatus = (num: PageNum): 'loaded' | 'loading' | 'empty' => {
    const key = pageKey(num, selectedCustomer, selectedPeriod);
    if (pageData[key]) return 'loaded';
    if (loadingPages.has(num)) return 'loading';
    return 'empty';
  };

  return (
    <div className="space-y-5">
      {/* -- Controls Row (Customer, Period, Industry, PDF) -- */}
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

      {/* -- Error Alert -- */}
      {error && (
        <div
          className="p-4 rounded-lg border text-sm flex items-start gap-3 print:hidden"
          style={{
            background: 'rgba(196, 56, 48, 0.06)',
            color: 'var(--danger)',
            borderColor: 'rgba(196, 56, 48, 0.2)',
          }}
        >
          <span className="text-lg">&#9888;&#65039;</span>
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

      {/* -- Page Tabs (with load status indicators) -- */}
      <div
        className="flex gap-0 print:hidden"
        style={{
          borderBottom: '2px solid var(--border-color)',
        }}
      >
        {([1, 2, 3, 4] as PageNum[]).map((num) => {
          const isActive = currentPage === num;
          const status = getPageLoadStatus(num);
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
              {/* Small dot showing load status */}
              {!isActive && status === 'loaded' && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--success)' }}
                />
              )}
              {!isActive && status === 'loading' && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--copper)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* -- Page Content -- */}
      {isCurrentLoading && !currentPageData ? (
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
      ) : !isCurrentLoading && selectedCustomer && selectedPeriod ? (
        <div
          className="text-center py-16"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p className="font-medium">Keine Daten verfügbar</p>
          <p className="text-sm mt-2">
            Für {selectedCustomer.replace(/_/g, ' ')} / {selectedPeriod} wurden keine Daten gefunden
          </p>
          <button
            onClick={() => {
              setLoadingPages(prev => new Set(prev).add(currentPage));
              loadSinglePage(currentPage, selectedCustomer, selectedPeriod, loadIdRef.current);
            }}
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
