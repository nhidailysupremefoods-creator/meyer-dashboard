'use client';

import { useState, useCallback } from 'react';
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
 */
export function useAdmin(): UseAdminReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.fetchAdminInit();

      if (!response.success) {
        throw new APIError(
          response.error || 'Admin-Daten konnten nicht geladen werden'
        );
      }

      // Handle both flat {customers:[]} and nested {data:{customers:[]}} response structures
      const d: any = (response as any).data || response;

      // Transform customers: Apps Script returns customer_name/status, frontend expects name/is_active
      const rawCustomers = d.customers || [];
      const normalizedCustomers = rawCustomers.map((c: any) => ({
        ...c,
        name: c.name || c.customer_name || c.display_name || c.customer_id,
        is_active: c.is_active !== undefined ? c.is_active : (c.status === 'active'),
      }));
      setCustomers(normalizedCustomers);

      // Transform users: Apps Script returns user_email, frontend expects email
      const rawUsers = d.users || [];
      const normalizedUsers = rawUsers.map((u: any) => ({
        ...u,
        email: u.email || u.user_email || '',
        display_name: u.display_name || u.user_email || u.email || '',
      }));
      setUsers(normalizedUsers);

      setRegistrations(d.registrations || []);

      // Transform audit: epoch seconds → ISO string, actor_email → user_email, 0 → null
      const rawAudit = d.audit || [];
      const normalizedAudit = rawAudit.map((a: any) => {
        const ts = a.event_timestamp;
        let isoTimestamp = a.event_timestamp;
        if (typeof ts === 'number') {
          // epoch seconds (< 2e10) or milliseconds (>= 2e10)
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

      // Transform releases: Apps Script returns nested {CUSTOMER_ID: {releases: [...], available_months: [...]}}
      // Frontend expects flat Release[] array
      const rawReleases = d.releases;
      let flatReleases: Release[] = [];
      if (Array.isArray(rawReleases)) {
        flatReleases = rawReleases;
      } else if (rawReleases && typeof rawReleases === 'object') {
        // Nested format from adminInitAll() — flatten all customer release arrays
        Object.values(rawReleases).forEach((customerData: any) => {
          if (customerData?.releases && Array.isArray(customerData.releases)) {
            flatReleases.push(...customerData.releases);
          }
        });
      }
      setReleases(flatReleases);
    } catch (err: any) {
      const errorMsg =
        err instanceof APIError
          ? err.message
          : 'Fehler beim Laden der Admin-Daten';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const approveRegistration = useCallback(
    async (email: string): Promise<boolean> => {
      setError(null);

      try {
        const response = await api.approveRegistration(email);

        if (!response.success) {
          throw new APIError(response.error || 'Genehmigung fehlgeschlagen');
        }

        // Reload admin data
        await init();
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Genehmigen der Registrierung';
        setError(errorMsg);
        return false;
      }
    },
    [init]
  );

  const rejectRegistration = useCallback(
    async (email: string): Promise<boolean> => {
      setError(null);

      try {
        const response = await api.rejectRegistration(email);

        if (!response.success) {
          throw new APIError(response.error || 'Ablehnung fehlgeschlagen');
        }

        // Reload admin data
        await init();
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Ablehnen der Registrierung';
        setError(errorMsg);
        return false;
      }
    },
    [init]
  );

  const updateUser = useCallback(
    async (email: string, updates: Record<string, any>): Promise<boolean> => {
      setError(null);

      try {
        const response = await api.updateUser(email, updates);

        if (!response.success) {
          throw new APIError(response.error || 'Update fehlgeschlagen');
        }

        // Reload admin data
        await init();
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Aktualisieren des Benutzers';
        setError(errorMsg);
        return false;
      }
    },
    [init]
  );

  const updateCustomer = useCallback(
    async (
      customerId: string,
      updates: Record<string, any>
    ): Promise<boolean> => {
      setError(null);

      try {
        const response = await api.updateCustomer(customerId, updates);

        if (!response.success) {
          throw new APIError(response.error || 'Update fehlgeschlagen');
        }

        // Reload admin data
        await init();
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Aktualisieren des Kunden';
        setError(errorMsg);
        return false;
      }
    },
    [init]
  );

  const toggleRelease = useCallback(
    async (
      customerId: string,
      month: string,
      isReleased: boolean
    ): Promise<boolean> => {
      setError(null);

      try {
        const response = await api.toggleRelease(customerId, month, isReleased);

        if (!response.success) {
          throw new APIError(response.error || 'Toggle fehlgeschlagen');
        }

        // Reload admin data
        await init();
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Umschalten der Freigabe';
        setError(errorMsg);
        return false;
      }
    },
    [init]
  );

  const unreleaseAll = useCallback(
    async (customerId: string): Promise<boolean> => {
      setError(null);

      try {
        const response = await api.unreleaseAll(customerId);

        if (!response.success) {
          throw new APIError(response.error || 'Aktion fehlgeschlagen');
        }

        // Reload admin data
        await init();
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Sperren aller Monate';
        setError(errorMsg);
        return false;
      }
    },
    [init]
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
      const errorMsg =
        err instanceof APIError
          ? err.message
          : 'Fehler beim Löschen des Caches';
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
      const errorMsg =
        err instanceof APIError
          ? err.message
          : 'Fehler beim Starten des Rebuild';
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
          throw new APIError(
            response.error || 'Health Check fehlgeschlagen'
          );
        }

        return response;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Fehler beim Health Check';
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
