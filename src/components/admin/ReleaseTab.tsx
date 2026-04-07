'use client';

import { useState, useMemo } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Customer, Release } from '@/types';

interface ReleaseTabProps {
  customers: Customer[];
  releases: Release[];
  onUpdate: () => Promise<void>;
}

export default function ReleaseTab({ customers, releases, onUpdate }: ReleaseTabProps) {
  const { toggleRelease, unreleaseAll, loading, error } = useAdmin();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(
    customers[0]?.customer_id || ''
  );
  const [toggling, setToggling] = useState<string | null>(null);

  const getMonthKey = (month: string) => month.replace(/_/g, '-');

  // Get releases for selected customer
  const customerReleases = useMemo(() => {
    return releases.filter((r) => r.customer_id === selectedCustomer);
  }, [releases, selectedCustomer]);

  // Build calendar grid for last 12 months + current + next 3
  const months = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = -12; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      result.push(`${year}-${month}`);
    }
    return result;
  }, []);

  const releasedSet = useMemo(() => {
    const set = new Set<string>();
    customerReleases.forEach((r) => {
      const key = getMonthKey(r.report_month);
      if (r.is_released) {
        set.add(key);
      }
    });
    return set;
  }, [customerReleases]);

  const releasedCount = releasedSet.size;

  const handleToggle = async (month: string) => {
    const key = getMonthKey(month);
    const isCurrentlyReleased = releasedSet.has(key);

    setToggling(month);
    try {
      await toggleRelease(selectedCustomer, month.replace(/-/g, '_'), !isCurrentlyReleased);
      await onUpdate();
    } finally {
      setToggling(null);
    }
  };

  const handleUnreleaseAll = async () => {
    if (!window.confirm('Möchten Sie alle Monate für diesen Mandanten sperren?')) {
      return;
    }

    try {
      await unreleaseAll(selectedCustomer);
      await onUpdate();
    } catch (err) {
      console.error('Error unrelease all:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Customer Selector */}
      <div className="px-6 py-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mandant
        </label>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="block w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          {customers.map((customer) => (
            <option key={customer.customer_id} value={customer.customer_id}>
              {customer.name || customer.display_name || customer.customer_id}
            </option>
          ))}
        </select>
      </div>

      {/* Counter and Actions */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{releasedCount}</span> von{' '}
            <span className="font-semibold text-gray-900">{months.length}</span> Monate
            freigegeben
          </p>
        </div>
        <button
          onClick={handleUnreleaseAll}
          disabled={loading || releasedCount === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:bg-gray-400"
        >
          Alle sperren
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {months.map((month) => {
            const key = getMonthKey(month);
            const isReleased = releasedSet.has(key);
            const [year, monthNum] = month.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString(
              'de-DE',
              { month: 'short', year: '2-digit' }
            );

            return (
              <button
                key={month}
                onClick={() => handleToggle(month)}
                disabled={toggling === month || loading}
                className={`p-3 rounded-md border-2 font-medium text-sm transition-colors ${
                  isReleased
                    ? 'border-green-500 bg-green-50 text-green-900 hover:bg-green-100'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {toggling === month ? '...' : monthName}
              </button>
            );
          })}
        </div>
      </div>

      {customers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Keine Mandanten vorhanden
        </div>
      )}
    </div>
  );
}
