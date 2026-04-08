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

  // Check if already logged in
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');

  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerFirma, setRegisterFirma] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // Password reset state (2-step)
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
      const payload: LoginRequest = {
        email: loginEmail,
        access_code: loginCode,
      };

      const response = await api.login(payload);

      if (response.success && response.token) {
        setSuccess('Login erfolgreich!');
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        setError(response.error || 'Login fehlgeschlagen');
      }
    } catch (err: any) {
      setError(
        err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es spÃ¤ter erneut.'
      );
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
      const payload: RegisterRequest = {
        email: registerEmail,
        name: registerName,
        firma: registerFirma,
        password: registerPassword,
      };

      const response = await api.register(payload);

      if (response.ok || response.success) {
        setSuccess('Registrierung erfolgreich! Ein Administrator wird Ihre Anfrage Ã¼berprÃ¼fen.');
        setTimeout(() => {
          setView('login');
          setRegisterEmail('');
          setRegisterName('');
          setRegisterFirma('');
          setRegisterPassword('');
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
      const payload: ResetRequest = {
        email: resetEmail,
      };

      const response = await api.requestReset(payload);

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
      const payload: ConfirmResetRequest = {
        email: resetEmail,
        code: resetCode,
        new_password: resetPassword,
      };

      const response = await api.confirmReset(payload);

      if (response.success) {
        setSuccess('Passwort erfolgreich zurÃ¼ckgesetzt!');
        setTimeout(() => {
          setView('login');
          setResetStep('email');
          setResetEmail('');
          setResetCode('');
          setResetPassword('');
        }, 2000);
      } else {
        setError(response.error || 'ZurÃ¼cksetzen fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
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
            fontSize: '1rem', color: 'var(--navy)', letterSpacing: '0.05em',
          }}>MD</div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: 'var(--offwhite)', marginBottom: '0.25rem' }}>
            Meyer Decision
          </h1>
          <p style={{ color: 'var(--copper)', fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            Steuerungs-Dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--navy-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.875rem',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Error Alert */}
          {error && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(16,185,129,0.1)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8,
              fontSize: '0.875rem',
            }}>
              {success}
            </div>
          )}

          {/* Login View */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">E-Mail-Adresse</label>
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
                <label className="block text-sm font-medium mb-2">Zugangscode</label>
                <input
                  type="password"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="Zugangscode eingeben"
                  required
                  disabled={isLoading}
                />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird eingeloggt...' : 'Einloggen'}
              </button>
              <div className="text-sm text-center" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => { setView('reset'); setError(null); setSuccess(null); }}
                  style={{ display: 'block', width: '100%', fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  Passwort vergessen?
                </button>
                <div style={{ paddingTop: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Noch nicht registriert?</p>
                  <button
                    type="button"
                    onClick={() => { setView('register'); setError(null); setSuccess(null); }}
                    style={{ fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Neu registrieren
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Register View */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">E-Mail-Adresse</label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="ihre@email.com"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Ihr Name"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Firma</label>
                <input
                  type="text"
                  value={registerFirma}
                  onChange={(e) => setRegisterFirma(e.target.value)}
                  placeholder="Ihre Firma"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Passwort</label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Passwort wÃ¤hlen"
                  required
                  disabled={isLoading}
                />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird registriert...' : 'Registrieren'}
              </button>
              <div className="text-center" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setView('login'); setError(null); setSuccess(null); }}
                  style={{ fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  ZurÃ¼ck zum Login
                </button>
              </div>
            </form>
          )}

          {/* Reset View */}
          {view === 'reset' && resetStep === 'email' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Code zum ZurÃ¼cksetzen des Passworts.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">E-Mail-Adresse</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="ihre@email.com"
                  required
                  disabled={isLoading}
                />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird gesendet...' : 'Code anfordern'}
              </button>
              <div className="text-center" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setView('login'); setResetStep('email'); setError(null); setSuccess(null); }}
                  style={{ fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  ZurÃ¼ck zum Login
                </button>
              </div>
            </form>
          )}

          {/* Reset Confirm View */}
          {view === 'reset' && resetStep === 'confirm' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Geben Sie den Code aus Ihrer E-Mail und ein neues Passwort ein.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">Reset-Code</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-stelliger Code"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Neues Passwort</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Neues Passwort"
                  required
                  disabled={isLoading}
                />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Wird zurÃ¼ckgesetzt...' : 'Passwort zurÃ¼cksetzen'}
              </button>
              <div className="text-center" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setView('login'); setResetStep('email'); setError(null); setSuccess(null); }}
                  style={{ fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  ZurÃ¼ck zum Login
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
          Meyer Decision GmbH â Steuerungs-Dashboard v6
        </p>
      </div>
    </div>
  );
}
