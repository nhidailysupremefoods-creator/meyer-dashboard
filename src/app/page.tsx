'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LoginRequest, RegisterRequest, ResetRequest, ConfirmResetRequest } from '@/types';

type ViewType = 'login' | 'register' | 'reset';

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
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerFirma, setRegisterFirma] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'confirm'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setIsLoading(true);
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
    setError(null); setSuccess(null); setIsLoading(true);
    try {
      const response = await api.register({ email: registerEmail, name: registerName, firma: registerFirma, password: registerPassword } as RegisterRequest);
      if (response.ok || response.success) {
        setSuccess('Registrierung erfolgreich! Ein Administrator wird Ihre Anfrage prüfen.');
        setTimeout(() => { setView('login'); setRegisterEmail(''); setRegisterName(''); setRegisterFirma(''); setRegisterPassword(''); }, 2000);
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
    setError(null); setSuccess(null); setIsLoading(true);
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
    setError(null); setSuccess(null); setIsLoading(true);
    try {
      const response = await api.confirmReset({ email: resetEmail, code: resetCode, new_password: resetPassword } as ConfirmResetRequest);
      if (response.success) {
        setSuccess('Passwort erfolgreich zurückgesetzt!');
        setTimeout(() => { setView('login'); setResetStep('email'); setResetEmail(''); setResetCode(''); setResetPassword(''); }, 2000);
      } else {
        setError(response.error || 'Zurücksetzen fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const linkStyle: React.CSSProperties = {
    fontWeight: 600, color: 'var(--copper-light)', background: 'none',
    border: 'none', fontSize: '0.875rem', cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--navy)', padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: 'var(--copper)', margin: '0 auto 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Manrope, sans-serif', fontWeight: 800,
            fontSize: '1rem', color: '#FFFFFF', letterSpacing: '0.05em',
          }}>MD</div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: '#FFFFFF', marginBottom: '0.25rem' }}>
            Meyer Decision
          </h1>
          <p style={{ color: 'var(--copper-light)', fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            Steuerungs-Dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--navy-card)',
          border: '1px solid rgba(184, 115, 51, 0.2)',
          borderRadius: '0.875rem',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Alerts */}
          {error && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(196,56,48,0.12)', color: '#E88080',
              border: '1px solid rgba(196,56,48,0.3)', borderRadius: 8, fontSize: '0.875rem',
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(46,139,87,0.12)', color: '#6ECF91',
              border: '1px solid rgba(46,139,87,0.3)', borderRadius: 8, fontSize: '0.875rem',
            }}>{success}</div>
          )}

          {/* Login */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#FFFFFF' }}>E-Mail-Adresse</label>
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ihre@email.com" required disabled={isLoading}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(184,115,51,0.25)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#FFFFFF' }}>Zugangscode</label>
                <input type="password" value={loginCode} onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="Zugangscode eingeben" required disabled={isLoading}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(184,115,51,0.25)' }}
                />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird eingeloggt...' : 'Einloggen'}
              </button>
              <div className="text-sm text-center" style={{ marginTop: '1rem' }}>
                <button type="button" onClick={() => { setView('reset'); setError(null); setSuccess(null); }} style={{ ...linkStyle, display: 'block', width: '100%' }}>
                  Passwort vergessen?
                </button>
                <div style={{ paddingTop: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid rgba(184,115,51,0.15)' }}>
                  <p style={{ marginBottom: '0.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Noch nicht registriert?</p>
                  <button type="button" onClick={() => { setView('register'); setError(null); setSuccess(null); }} style={linkStyle}>
                    Neu registrieren
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Register */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {[
                { label: 'E-Mail-Adresse', type: 'email', val: registerEmail, set: setRegisterEmail, ph: 'ihre@email.com', req: true },
                { label: 'Name', type: 'text', val: registerName, set: setRegisterName, ph: 'Ihr Name', req: true },
                { label: 'Firma', type: 'text', val: registerFirma, set: setRegisterFirma, ph: 'Ihre Firma', req: false },
                { label: 'Passwort', type: 'password', val: registerPassword, set: setRegisterPassword, ph: 'Passwort wählen', req: true },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#FFFFFF' }}>{f.label}</label>
                  <input type={f.type} value={f.val} onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph} required={f.req} disabled={isLoading}
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(184,115,51,0.25)' }}
                  />
                </div>
              ))}
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
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Code zum Zurücksetzen.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#FFFFFF' }}>E-Mail-Adresse</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="ihre@email.com" required disabled={isLoading}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(184,115,51,0.25)' }}
                />
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
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
                Geben Sie den Code aus Ihrer E-Mail und ein neues Passwort ein.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#FFFFFF' }}>Reset-Code</label>
                <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-stelliger Code" required disabled={isLoading}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(184,115,51,0.25)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#FFFFFF' }}>Neues Passwort</label>
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Neues Passwort" required disabled={isLoading}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(184,115,51,0.25)' }}
                />
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

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '1.5rem' }}>
          Meyer Decision GmbH — Steuerungs-Dashboard
        </p>
      </div>
    </div>
  );
}
