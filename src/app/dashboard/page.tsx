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
  4: 'Maßnahmen',
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

  useEffect(() => {
    const data = api.getAuthData();
    if (data) {
      setAuthData(data);
      if (data.customers && data.customers.length > 0) {
        const list = data.customers.map((id: string) => ({
          customer_id: id,
          customer_name: id.replace(/_/g, ' '),
          is_active: true,
        }));
        setCustomerList(list);
        setSelectedCustomer(data.customers[0]);
      } else {
        const tok = api.getToken();
        if (tok) {
          fetch('/api/dashboard/customers?action=customers', {
              headers: { 'Authorization': `Bearer ${tok}` },
            })
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

  useEffect(() => {
    if (!selectedCustomer) return;

    const loadPeriods = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.fetchPeriods(selectedCustomer);
        const periodsArr = response.periods || (response as any).rows || [];
        if (periodsArr.length > 0) {
          const normalized = periodsArr.map((p: any) => ({
            period: p.period || p.month_id || '',
            label: p.label || p.month_label_short || p.month_label || p.month_id || '',
          })).filter((p: any) => p.period !== '');
          setPeriods(normalized);
          const seg = (response as any).industry_segment || (response as any).industrySegment;
          if (seg) setIndustrySegment(seg);
          if (normalized.length > 0) {
            setSelectedPeriod(normalized[0].period);
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

  const loadPageData = useCallback(
    async (page: PageNum, customer: string, period: string) => {
      if (!customer || !period) return;
      setLoading(true);
      setError(null);
      try {
        const response = await api.fetchPageData(page, customer, period);
        if (response.success) {
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

  // Prefetch ALL 4 pages in parallel when customer/period changes
  useEffect(() => {
    if (!selectedCustomer || !selectedPeriod) return;
    setPageData({} as any);
    setLoading(true);
    setError(null);

    // Load current page first, then rest in parallel
    const pages: PageNum[] = [1, 2, 3, 4];
    // Prioritize current page
    const sorted = [currentPage, ...pages.filter(p => p !== currentPage)] as PageNum[];

    sorted.forEach(async (page) => {
      try {
        const response = await api.fetchPageData(page, selectedCustomer, selectedPeriod);
        if (response.success) {
          setPageData((prev) => ({ ...prev, [page]: response }));
        }
      } catch {
        // Silently fail for background pages
      } finally {
        // Only clear loading for current page
        if (page === currentPage) setLoading(false);
      }
    });
  }, [selectedCustomer, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // When switching tabs, load only if not already cached
  useEffect(() => {
    if (selectedCustomer && selectedPeriod && !pageData[currentPage]) {
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
        return <Page1Gesamtlage data={currentPageData} industrySegment={industrySegment} />;
      case 2:
        return <Page2Vertragsanalyse data={currentPageData} industrySegment={industrySegment} />;
      case 3:
        return <Page3Liquiditaet data={currentPageData} />;
      case 4:
        return (
          <Page4Massnahmen
            data={currentPageData}
            customer={selectedCustomer}
            period={selectedPeriod}
            industrySegment={industrySegment}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="card flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Mandant</label>
          <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full">
            {customerList.map((c) => (<option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>))}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Berichtsperiode</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full" disabled={periods.length === 0}>
            {periods.map((p) => (<option key={p.period} value={p.period}>{p.label}</option>))}
          </select>
        </div>
        {industrySegment && (
          <div className="flex-shrink-0">
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Branche</div>
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(176,138,106,0.15)', color: 'var(--accent)' }}>{industrySegment.replace(/_/g, ' ')}</span>
          </div>
        )}
        {selectedCustomer && selectedPeriod && (
          <div className="flex-shrink-0 self-end">
            <a
              href={`/dashboard/print?customer=${encodeURIComponent(selectedCustomer)}&period=${encodeURIComponent(selectedPeriod)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              PDF Export
            </a>
          </div>
        )}
      </div>
      {error && (
        <div className="p-4 rounded-xl border text-sm flex items-start gap-3" style={{ background: 'rgb(254,242,242)', color: 'var(--danger)', borderColor: 'rgb(254,205,211)' }}>
          <span className="text-lg">⚠️</span>
          <div><strong>Fehler:</strong> {error}</div>
          <button onClick={() => setError(null)} className="ml-auto text-xs" style={{ color: 'var(--danger)' }}>✕</button>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([1, 2, 3, 4] as PageNum[]).map((num) => (
          <button key={num} onClick={() => setCurrentPage(num)} className="px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap" style={currentPage === num ? { backgroundColor: 'var(--primary)', color: 'white', boxShadow: '0 2px 8px rgba(26,54,93,0.25)' } : { backgroundColor: 'var(--background-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}><span className="opacity-60 mr-1">{num}</span>{PAGE_TITLES[num]}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: 'var(--primary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>{PAGE_TITLES[currentPage]} wird geladen...</p>
          </div>
        </div>
      ) : currentPageData ? (
        <div>
          {renderPage()}
        </div>
      ) : !loading && selectedCustomer && selectedPeriod ? (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
          <div className="text-4xl mb-4">📊</div>
          <p className="font-medium">Keine Daten verfügbar</p>
          <p className="text-sm mt-2">Für {selectedCustomer} / {selectedPeriod} wurden keine Daten gefunden</p>
          <button onClick={() => loadPageData(currentPage, selectedCustomer, selectedPeriod)} className="btn-primary mt-4 px-4 py-2 rounded-lg text-sm">Erneut versuchen</button>
        </div>
      ) : (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
          <p>Bitte Mandant und Periode auswählen</p>
        </div>
      )}
    </div>
  );
}
