'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserProvider, useCurrentUser } from '@/lib/internal-os/user-context';

// Internal OS eigene Styles – isoliert vom Kunden-Dashboard
const styles = `
  .ios-body { display: flex; height: 100vh; overflow: hidden; background: #F7F5F2; font-family: 'Inter', sans-serif; }
  .ios-sidebar { width: 256px; background: #192231; display: flex; flex-direction: column; flex-shrink: 0; }
  .ios-main { flex: 1; overflow-y: auto; }
  .ios-content { max-width: 1400px; margin: 0 auto; padding: 32px; }
`;

const NAV_ITEMS = [
  { href: '/internal',            label: 'Dashboard',  icon: '📊', desc: 'Übersicht' },
  { href: '/internal/crm',        label: 'CRM & ICP',  icon: '👥', desc: 'Leads & Scoring' },
  { href: '/internal/mandate',    label: 'Mandate',    icon: '📋', desc: 'Verträge & MRR' },
  { href: '/internal/operations', label: 'Operations', icon: '⚡', desc: 'Workflow & Versand' },
];

export default function InternalOSLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <InternalOSLayoutInner>{children}</InternalOSLayoutInner>
    </UserProvider>
  );
}

function InternalOSLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, setCurrentUser } = useCurrentUser();

  return (
    <>
      <style>{styles}</style>
      <div className="ios-body">
        {/* Sidebar */}
        <aside className="ios-sidebar">
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
              Meyer Decision
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Internal OS</div>
          </div>

          <nav style={{ flex: 1, padding: '16px 12px' }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/internal' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '12px',
                    textDecoration: 'none', fontSize: '14px', marginBottom: '4px',
                    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: active ? '#B08A6A' : 'rgba(255,255,255,0.6)',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: '20px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
                  <div>
                    <div>{item.label}</div>
                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '1px' }}>{item.desc}</div>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
              Aktiver Benutzer
            </div>
            <select
              value={currentUser}
              onChange={e => setCurrentUser(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.8)',
                outline: 'none',
              }}
            >
              <option value="gregory@meyerdecision.com">Gregory Meyer</option>
              <option value="nhi@meyerdecision.com">Nhi Meyer</option>
            </select>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ios-main">
          <div className="ios-content">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
