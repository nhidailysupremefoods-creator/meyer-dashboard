'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LoginRequest, RegisterRequest, ResetRequest, ConfirmResetRequest } from '@/types';

type ViewType = 'login' | 'register' | 'reset';

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewType>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [registerEmail, setRegisterEmail] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerFirma, setRegisterFirma] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [resetStep, setResetStep] = useState<'email' | 'confirm'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const response = await api.login({ email: loginEmail, access_code: loginCode } as LoginRequest);
      if (response.success && response.token) {
        setSuccess('Login erfolgreich!');
        setTimeout(() => router.push('/dashboard'), 500);
      } else {
        setError(response.error || 'Login fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const response = await api.register({ email: registerEmail, name: registerName, firma: registerFirma, password: registerPassword } as RegisterRequest);
      if (response.ok || response.success) {
        setSuccess('Registrierung erfolgreich! Ein Administrator wird Ihre Anfrage prüfen.');
        setTimeout(() => {
          setView('login');
          setRegisterEmail(''); setRegisterName(''); setRegisterFirma(''); setRegisterPassword('');
        }, 2000);
      } else {
        setError(response.error || 'Registrierung fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const response = await api.requestReset({ email: resetEmail } as ResetRequest);
      if (response.success) {
        setSuccess('Reset-Code wurde an Ihre E-Mail gesendet');
        setResetStep('confirm');
      } else {
        setError(response.error || 'Anfrage fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const response = await api.confirmReset({ email: resetEmail, code: resetCode, new_password: resetPassword } as ConfirmResetRequest);
      if (response.success) {
        setSuccess('Passwort erfolgreich zurückgesetzt!');
        setTimeout(() => {
          setView('login');
          setResetStep('email');
          setResetEmail(''); setResetCode(''); setResetPassword('');
        }, 2000);
      } else {
        setError(response.error || 'Zurücksetzen fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const eyeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--copper)',
    display: 'flex',
    alignItems: 'center',
    padding: '0',
    lineHeight: 1,
  };

  const linkStyle: React.CSSProperties = {
    fontWeight: 600,
    color: 'var(--copper)',
    background: 'none',
    border: 'none',
    fontSize: '0.875rem',
    cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--background)',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--navy)',
            padding: '12px 26px',
            borderRadius: '10px',
            marginBottom: '0.75rem',
          }}>
            <img src="/logo.svg" alt="Meyer Decision" style={{ height: '48px' }} />
          </div>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 500,
            margin: 0,
          }}>
            Steuerungs-Dashboard
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2rem', boxShadow: '0 4px 24px rgba(25, 34, 49, 0.10)' }}>

          {/* Alerts */}
          {error && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(196,56,48,0.08)', color: 'var(--danger)',
              border: '1px solid rgba(196,56,48,0.25)', borderRadius: 8, fontSize: '0.875rem',
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(46,139,87,0.08)', color: 'var(--success)',
              border: '1px solid rgba(46,139,87,0.25)', borderRadius: 8, fontSize: '0.875rem',
            }}>{success}</div>
          )}

          {/* Login */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>E-Mail-Adresse</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ihre@email.com"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Passwort</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                    placeholder="Passwort eingeben"
                    required
                    disabled={isLoading}
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={eyeBtnStyle}
                    tabIndex={-1}
                    aria-label={showLoginPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    <EyeIcon open={showLoginPassword} />
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird eingeloggt...' : 'Einloggen'}
              </button>
              <div className="text-sm text-center" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => { setView('reset'); setError(null); setSuccess(null); }}
                  style={{ ...linkStyle, display: 'block', width: '100%' }}
                >
                  Passwort vergessen?
                </button>
                <div style={{ paddingTop: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Noch kein Konto?</p>
                  <button
                    type="button"
                    onClick={() => { setView('register'); setError(null); setSuccess(null); }}
                    style={linkStyle}
                  >
                    Jetzt registrieren
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Register */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>E-Mail-Adresse</label>
                <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="ihre@email.com" required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Name</label>
                <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder="Ihr Name" required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Firma</label>
                <input type="text" value={registerFirma} onChange={(e) => setRegisterFirma(e.target.value)} placeholder="Ihre Firma" disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Passwort</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Passwort wählen"
                    required
                    disabled={isLoading}
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)} style={eyeBtnStyle} tabIndex={-1} aria-label={showRegisterPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                    <EyeIcon open={showRegisterPassword} />
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird registriert...' : 'Registrieren'}
              </button>
              <div className="text-center" style={{ marginTop: '0.75rem' }}>
                <button type="button" onClick={() => { setView('login'); setError(null); setSuccess(null); }} style={linkStyle}>
                  Zurück zum Login
                </button>
              </div>
            </form>
          )}

          {/* Reset Step 1 */}
          {view === 'reset' && resetStep === 'email' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Code zum Zurücksetzen.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>E-Mail-Adresse</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="ihre@email.com" required disabled={isLoading} />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird gesendet...' : 'Code anfordern'}
              </button>
              <div className="text-center" style={{ marginTop: '0.75rem' }}>
                <button type="button" onClick={() => { setView('login'); setResetStep('email'); setError(null); setSuccess(null); }} style={linkStyle}>
                  Zurück zum Login
                </button>
              </div>
            </form>
          )}

          {/* Reset Step 2 */}
          {view === 'reset' && resetStep === 'confirm' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Geben Sie den Code aus Ihrer E-Mail und ein neues Passwort ein.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Reset-Code</label>
                <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="6-stelliger Code" required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Neues Passwort</label>
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Neues Passwort" required disabled={isLoading} />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird zurückgesetzt...' : 'Passwort zurücksetzen'}
              </button>
              <div className="text-center" style={{ marginTop: '0.75rem' }}>
                <button type="button" onClick={() => { setView('login'); setResetStep('email'); setError(null); setSuccess(null); }} style={linkStyle}>
                  Zurück zum Login
                </button>
              </div>
            </form>
          )}

        </div>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1.5rem', opacity: 0.6 }}>
          Meyer Decision GbR – Steuerungs-Dashboard
        </p>
      </div>
    </div>
  );
}
