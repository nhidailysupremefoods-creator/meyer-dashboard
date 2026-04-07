'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { User, Customer } from '@/types';

interface UserTabProps {
  users: User[];
  customers: Customer[];
  onUpdate: () => Promise<void>;
}

export default function UserTab({ users, customers, onUpdate }: UserTabProps) {
  const { updateUser, loading, error } = useAdmin();
  const [saving, setSaving] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Record<string, string>>({});
  const [editingCustomer, setEditingCustomer] = useState<Record<string, string>>({});

  const handleRoleChange = (email: string, value: string) => {
    setEditingRole({
      ...editingRole,
      [email]: value,
    });
  };

  const handleCustomerChange = (email: string, value: string) => {
    setEditingCustomer({
      ...editingCustomer,
      [email]: value,
    });
  };

  const handleSave = async (email: string) => {
    const newRole = editingRole[email];
    const newCustomer = editingCustomer[email];

    if (!newRole && !newCustomer) return;

    setSaving(email);
    try {
      const updates: Record<string, any> = {};
      if (newRole && newRole !== users.find((u) => u.email === email)?.role) {
        updates.role = newRole;
      }
      if (newCustomer && newCustomer !== users.find((u) => u.email === email)?.customer_id) {
        updates.customer_id = newCustomer;
      }

      if (Object.keys(updates).length > 0) {
        const success = await updateUser(email, updates);
        if (success) {
          setEditingRole({ ...editingRole, [email]: '' });
          setEditingCustomer({ ...editingCustomer, [email]: '' });
          await onUpdate();
        }
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
                E-Mail
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rolle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mandant
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
            {users.map((user) => (
              <tr key={user.email} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <select
                    value={editingRole[user.email] || user.role || 'customer'}
                    onChange={(e) => handleRoleChange(user.email, e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="customer">Kunde</option>
                    <option value="viewer">Betrachter</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <select
                    value={editingCustomer[user.email] || user.customer_id || ''}
                    onChange={(e) => handleCustomerChange(user.email, e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="__GLOBAL__">-- Global --</option>
                    {customers.map((customer) => (
                      <option key={customer.customer_id} value={customer.customer_id}>
                        {customer.name || customer.display_name || customer.customer_id}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {(editingRole[user.email] && editingRole[user.email] !== user.role) ||
                  (editingCustomer[user.email] && editingCustomer[user.email] !== user.customer_id) ? (
                    <button
                      onClick={() => handleSave(user.email)}
                      disabled={saving === user.email || loading}
                      className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {saving === user.email ? 'Speichern...' : 'Speichern'}
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

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Keine Benutzer vorhanden
        </div>
      )}
    </div>
  );
}
