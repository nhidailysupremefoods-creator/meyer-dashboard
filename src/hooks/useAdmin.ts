'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Customer,
  User,
  Registration,
  AuditEntry,
  Release,
  HealthCheckResponse,
  APIError,
} from '@/types';

interface UseAdminReturn {
  // Data
  customers: Customer[];
  users: User[];
  registrations: Registration[];
  audit: AuditEntry[];
  releases: Release[];

  // Status
  loading: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  clearError: () => void;
  approveRegistration: (email: string) => Promise<boolean>;
  rejectRegistration: (email: string) => Promise<boolean>;
  updateUser: (email: string, updates: Record<string, any>) => Promise<boolean>;
  updateCustomer: (customerId: string, updates: Record<string, any>) => Promise<boolean>;
  toggleRelease: (customerId: string, month: string, isReleased: boolean) => Promise<boolean>;
  unreleaseAll: (customerId: string) => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  triggerRebuild: () => Promise<boolean>;
  checkHealth: () => Promise<HealthCheckResponse | null>;
}

/**
 * Custom hook for admin operations
 * Manages customers, users, registrations, audit log, and releases
 *
 * PERFORMANCE: Mutations return immediately after server confirms success.
 * Background refresh (init()) is triggered but NOT awaited, so the UI stays snappy.
 */
export function useAdmin(): UseAdminReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent concurrent init calls
  const initInFlight = useRef(false);

  const init = useCallback(async () => {
    // Skip if already loading
    if (initInFlight.current) return;
    initInFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await api.fetchAdminInit();

      if (!response.success) {
        const errMsg = response.error || 'Admin-Daten konnten nicht geladen werden';
        // Detect session expiry → clear auth and redirect to login
        const isSessionExpired = errMsg.toLowerCase().includes('admin-zugriff')
          || errMsg.toLowerCase().includes('token')
          || errMsg.toLowerCase().includes('session');
        if (isSessionExpired && typeof window !== 'undefined') {
          localStorage.removeItem('md_session_token');
          localStorage.removeItem('md_auth_data');
          window.location.href = '/';
          return;
        }
        throw new APIError(errMsg);
      }

      // Handle both flat {customers:[]} and nested {data:{customers:[]}} response structures
      const d: any = (response as any).data || response;

      // Transform customers
      const rawCustomers = d.customers || [];
      const normalizedCustomers = rawCustomers.map((c: any) => ({
        ...c,
        name: c.name || c.customer_name || c.display_name || c.customer_id,
        is_active: c.is_active !== undefined ? c.is_active : (c.status === 'active'),
      }));
      setCustomers(normalizedCustomers);

      // Transform users
      const rawUsers = d.users || [];
      const normalizedUsers = rawUsers.map((u: any) => ({
        ...u,
        email: u.email || u.user_email || '',
        display_name: u.display_name || u.user_email || u.email || '',
      }));
      setUsers(normalizedUsers);

      setRegistrations(d.registrations || []);

      // Transform audit: epoch seconds → ISO string
      const rawAudit = d.audit || [];
      const normalizedAudit = rawAudit.map((a: any) => {
        const ts = a.event_timestamp;
        let isoTimestamp = a.event_timestamp;
        if (typeof ts === 'number') {
          isoTimestamp = ts < 2e10
            ? new Date(ts * 1000).toISOString()
            : new Date(ts).toISOString();
        }
        return {
          ...a,
          event_timestamp: isoTimestamp,
          user_email: a.user_email || (a.actor_email && a.actor_email !== 0 ? a.actor_email : '') || '',
          description: a.description || (a.notes && a.notes !== 0 ? a.notes : '') || (a.new_value && a.new_value !== 0 ? a.new_value : '') || '',
        };
      });
      setAudit(normalizedAudit);

      // Transform releases
      const rawReleases = d.releases;
      let flatReleases: Release[] = [];
      if (Array.isArray(rawReleases)) {
        flatReleases = rawReleases;
      } else if (rawReleases && typeof rawReleases === 'object') {
        Object.entries(rawReleases).forEach(([custId, customerData]: [string, any]) => {
          if (customerData?.releases && Array.isArray(customerData.releases)) {
            customerData.releases.forEach((r: any) => {
              flatReleases.push({ ...r, customer_id: r.customer_id || custId });
            });
          }
          if (Array.isArray(customerData)) {
            customerData.forEach((r: any) => {
              flatReleases.push({ ...r, customer_id: r.customer_id || custId });
            });
          }
        });
      }
      // Normalize is_released to boolean
      flatReleases = flatReleases.map((r) => ({
        ...r,
        report_month: r.report_month || '',
        is_released: r.is_released === true || (r.is_released as unknown) === 'true' || (r.is_released as unknown) === 'TRUE',
      }));
      setReleases(flatReleases);
    } catch (err: any) {
      const errorMsg =
        err instanceof APIError
          ? err.message
          : 'Fehler beim Laden der Admin-Daten';
      setError(errorMsg);
    } finally {
      setLoading(false);
      initInFlight.current = false;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Helper: Call API, check success, trigger background refresh.
   * Returns true immediately on success — doesn't wait for init() to complete.
   */
  const mutate = useCallback(
    async (
      apiCall: () => Promise<any>,
      errorLabel: string
    ): Promise<boolean> => {
      setError(null);
      try {
        const response = await apiCall();
        if (!response.success) {
          throw new APIError(response.error || `${errorLabel} fehlgeschlagen`);
        }
        // Background refresh — don't await, let UI stay snappy
        init().catch(() => {});
        return true;
      } catch (err: any) {
        const errorMsg = err instanceof APIError ? err.message : errorLabel;
        setError(errorMsg);
        return false;
      }
    },
    [init]
  );

  const approveRegistration = useCallback(
    (email: string) => mutate(
      () => api.approveRegistration(email),
      'Fehler beim Genehmigen der Registrierung'
    ),
    [mutate]
  );

  const rejectRegistration = useCallback(
    (email: string) => mutate(
      () => api.rejectRegistration(email),
      'Fehler beim Ablehnen der Registrierung'
    ),
    [mutate]
  );

  const updateUser = useCallback(
    (email: string, updates: Record<string, any>) => mutate(
      () => api.updateUser(email, updates),
      'Fehler beim Aktualisieren des Benutzers'
    ),
    [mutate]
  );

  const updateCustomer = useCallback(
    (customerId: string, updates: Record<string, any>) => mutate(
      () => api.updateCustomer(customerId, updates),
      'Fehler beim Aktualisieren des Kunden'
    ),
    [mutate]
  );

  const toggleRelease = useCallback(
    (customerId: string, month: string, isReleased: boolean) => mutate(
      () => api.toggleRelease(customerId, month, isReleased),
      'Fehler beim Umschalten der Freigabe'
    ),
    [mutate]
  );

  const unreleaseAll = useCallback(
    (customerId: string) => mutate(
      () => api.unreleaseAll(customerId),
      'Fehler beim Sperren aller Monate'
    ),
    [mutate]
  );

  const clearCache = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const response = await api.clearCache();
      if (!response.success) {
        throw new APIError(response.error || 'Cache-Löschung fehlgeschlagen');
      }
      return true;
    } catch (err: any) {
      const errorMsg = err instanceof APIError ? err.message : 'Fehler beim Löschen des Caches';
      setError(errorMsg);
      return false;
    }
  }, []);

  const triggerRebuild = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const response = await api.triggerRebuild();
      if (!response.success) {
        throw new APIError(response.error || 'Rebuild fehlgeschlagen');
      }
      return true;
    } catch (err: any) {
      const errorMsg = err instanceof APIError ? err.message : 'Fehler beim Starten des Rebuild';
      setError(errorMsg);
      return false;
    }
  }, []);

  const checkHealth = useCallback(
    async (): Promise<HealthCheckResponse | null> => {
      setError(null);
      try {
        const response = await api.fetchHealthCheck();
        if (!response.success) {
          throw new APIError(response.error || 'Health Check fehlgeschlagen');
        }
        return response;
      } catch (err: any) {
        const errorMsg = err instanceof APIError ? err.message : 'Fehler beim Health Check';
        setError(errorMsg);
        return null;
      }
    },
    []
  );

  return {
    customers,
    users,
    registrations,
    audit,
    releases,

    loading,
    error,

    init,
    clearError,
    approveRegistration,
    rejectRegistration,
    updateUser,
    updateCustomer,
    toggleRelease,
    unreleaseAll,
    clearCache,
    triggerRebuild,
    checkHealth,
  };
}
