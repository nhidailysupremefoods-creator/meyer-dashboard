'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { APIError } from '@/types';

interface UseDashboardReturn {
  // Navigation
  currentPage: number;
  currentPeriod: string | null;
  setCurrentPage: (page: number) => void;
  setCurrentPeriod: (period: string) => void;

  // Periods
  periods: Array<{period: string; label: string}>;
  industrySegment: string | null;
  loadingPeriods: boolean;
  periodError: string | null;

  // Page data cache
  pageData: Record<number, any>;
  loadingPage: Record<number, boolean>;
  pageError: Record<number, string | null>;

  // Actions
  loadPeriods: (customer: string) => Promise<void>;
  loadPage: (page: number, customer: string, period: string) => Promise<void>;
  clearCache: () => void;
}

/**
 * Custom hook for dashboard data management
 * Handles periods loading, page data caching per page number
 */
export function useDashboard(
  initialCustomer?: string,
  initialPeriod?: string
): UseDashboardReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(
    initialPeriod || null
  );

  // Periods
  const [periods, setPeriods] = useState<Array<{period: string; label: string}>>([]);
  const [industrySegment, setIndustrySegment] = useState<string | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Page data cache: Record<pageNumber, data>
  const [pageData, setPageData] = useState<Record<number, any>>({});
  const [loadingPage, setLoadingPage] = useState<Record<number, boolean>>({});
  const [pageError, setPageError] = useState<Record<number, string | null>>({});

  const loadPeriods = useCallback(
    async (customer: string) => {
      setLoadingPeriods(true);
      setPeriodError(null);

      try {
        const response = await api.fetchPeriods(customer);

        if (!response.success) {
          throw new APIError(
            response.error || 'Perioden konnten nicht geladen werden'
          );
        }

        setPeriods(response.periods || []);
        setIndustrySegment(response.industry_segment || null);

        // Set first period as current if not already set
        if (!currentPeriod && response.periods && response.periods.length > 0) {
          setCurrentPeriod(response.periods[0].period);
        }
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Laden der Perioden';
        setPeriodError(errorMsg);
      } finally {
        setLoadingPeriods(false);
      }
    },
    [currentPeriod]
  );

  const loadPage = useCallback(
    async (page: number, customer: string, period: string) => {
      // Return early if already cached and loading
      if (pageData[page] && !loadingPage[page]) {
        return;
      }

      setLoadingPage((prev) => ({ ...prev, [page]: true }));
      setPageError((prev) => ({ ...prev, [page]: null }));

      try {
        const response = await api.fetchPageData(page, customer, period);

        if (!response.success) {
          throw new APIError(
            response.error || `Seite ${page} konnte nicht geladen werden`
          );
        }

        setPageData((prev) => ({
          ...prev,
          [page]: response.data || {},
        }));
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : `Fehler beim Laden von Seite ${page}`;
        setPageError((prev) => ({ ...prev, [page]: errorMsg }));
      } finally {
        setLoadingPage((prev) => ({ ...prev, [page]: false }));
      }
    },
    [pageData, loadingPage]
  );

  const clearCache = useCallback(() => {
    setPageData({});
    setLoadingPage({});
    setPageError({});
    setPeriods([]);
    setIndustrySegment(null);
    setCurrentPeriod(null);
  }, []);

  return {
    currentPage,
    currentPeriod,
    setCurrentPage,
    setCurrentPeriod,

    periods,
    industrySegment,
    loadingPeriods,
    periodError,

    pageData,
    loadingPage,
    pageError,

    loadPeriods,
    loadPage,
    clearCache,
  };
}
