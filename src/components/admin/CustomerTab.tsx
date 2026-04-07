'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Customer } from '@/types';

const INDUSTRY_OPTIONS = [
  { value: 'B2B_CONTRACTING', label: 'B2B Contracting' },
  { value: 'INDUSTRIESERVICE', label: 'Industrieservice' },
  { value: 'TECHN_WARTUNG', label: 'Technische Wartung' },
  { value: 'HANDWERK', label: 'Handwerk' },
  { value: 'SONSTIGE', label: 'Sonstige' },
];

interface CustomerTabProps {
  customers: Customer[];
  onUpdate: () => Promise<void>;
}

export default function CustomerTab({ customers, onUpdate }: CustomerTabProps) {
  const { updateCustomer, loading, error } = useAdmin();
  const [saving, setSaving] = useState<string | null>(null);
  const [editingIndustry, setEditingIndustry] = useState<Record<string, string>>({});

  const handleIndustryChange = (customerId: string, value: string) => {
    setEditingIndustry({
      ...editingIndustry,
      [customerId]: value,
    });
  };

  const handleSave = async (customerId: string) => {
    const newIndustry = editingIndustry[customerId];
    if (!newIndustry) return;

    setSaving(customerId);
    try {
      const success = await updateCustomer(customerId, {
        industry_segment: newIndustry,
      });

      if (success) {
        setEditingIndustry({
          ...editingIndustry,
          [customerId]: '',
        });
        await onUpdate();
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mandanten-ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Abonnementtyp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Branche
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktion
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr key={customer.customer_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {customer.customer_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {customer.name || customer.display_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {customer.subscription_type || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <select
                    value={editingIndustry[customer.customer_id] || customer.industry_segment || ''}
                    onChange={(e) => handleIndustryChange(customer.customer_id, e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">-- Auswählen --</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      customer.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {editingIndustry[customer.customer_id] &&
                  editingIndustry[customer.customer_id] !== customer.industry_segment ? (
                    <button
                      onClick={() => handleSave(customer.customer_id)}
                      disabled={saving === customer.customer_id || loading}
                      className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {saving === customer.customer_id ? 'Speichern...' : 'Speichern'}
                    </button>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Keine Mandanten vorhanden
        </div>
      )}
    </div>
  );
}
