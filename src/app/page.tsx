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
        err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
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
        setSuccess('Registrierung erfolgreich! Ein Administrator wird Ihre Anfrage überprüfen.');
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
        setSuccess('Passwort erfolgreich zurückgesetzt!');
        setTimeout(() => {
          setView('login');
          setResetStep('email');
          setResetEmail('');
          setResetCode('');
          setResetPassword('');
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #0f1d35 0%, #1a365d 50%, #2b6cb0 100%)'}}>
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -z-10" style={{background: 'rgba(43, 108, 176, 0.1)'}} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl -z-10" style={{background: 'rgba(26, 54, 93, 0.1)'}} />

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Meyer Decision</h1>
          <p className="text-lg" style={{color: 'var(--accent-light)'}}>Steuerungs-Dashboard</p>
          <p className="text-gray-300 text-sm mt-2">
            Finanzielle Steuerung für Handwerksbetriebe
          </p>
        </div>

        {/* Card */}
        <div className="card rounded-2xl shadow-2xl p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-4 text-sm rounded-lg border" style={{background: 'rgb(254, 242, 242)', color: 'var(--danger)', borderColor: 'rgb(254, 205, 211)'}}>
              {error}
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-4 p-4 text-sm rounded-lg border" style={{background: 'rgb(240, 253, 244)', color: 'var(--success)', borderColor: 'rgb(187, 247, 208)'}}>
              {success}
            </div>
          )}

          {/* Login View */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  E-Mail-Adresse
                </label>
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
                <label className="block text-sm font-medium mb-2">
                  Zugangscode
                </label>
                <input
                  type="password"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Wird eingeloggt...' : 'Einloggen'}
              </button>

              {/* Links */}
              <div className="space-y-2 text-sm text-center">
                <button
                  type="button"
                  onClick={() => {
                    setView('reset');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="block w-full font-medium" style={{color: 'var(--accent)'}}
                >
                  Passwort vergessen?
                </button>
                <div className="pt-2" style={{borderTop: '1px solid var(--border-color)'}}>
                  <p className="mb-2" style={{color: 'var(--text-secondary)'}}>Noch nicht registriert?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setView('register');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="font-medium" style={{color: 'var(--accent)'}}
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
                <label className="block text-sm font-medium mb-2">
                  E-Mail-Adresse
                </label>
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
                <label className="block text-sm font-medium mb-2">
                  Vollständiger Name
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Max Mustermann"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Firma
                </label>
                <input
                  type="text"
                  value={registerFirma}
                  onChange={(e) => setRegisterFirma(e.target.value)}
                  placeholder="Mustermann GmbH"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Passwort wählen
                </label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <p className="text-xs mt-1" style={{color: 'var(--text-secondary)'}}>
                  Mindestens 8 Zeichen
                </p>
              </div>

              <div className="p-3 rounded-lg border" style={{background: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)'}}>
                <p className="text-xs" style={{color: 'var(--text-secondary)'}}>
                  Ihre Registrierung wird von einem Administrator geprüft.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Wird verarbeitet...' : 'Registrierung absenden'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                  setSuccess(null);
                  setRegisterEmail('');
                  setRegisterName('');
                  setRegisterFirma('');
                  setRegisterPassword('');
                }}
                className="w-full text-sm font-medium" style={{color: 'var(--accent)'}}
              >
                ← Zurück zum Login
              </button>
            </form>
          )}

          {/* Password Reset View */}
          {view === 'reset' && (
            <form
              onSubmit={resetStep === 'email' ? handleRequestReset : handleConfirmReset}
              className="space-y-4"
            >
              {resetStep === 'email' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      E-Mail-Adresse
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="ihre@email.com"
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs mt-1" style={{color: 'var(--text-secondary)'}}>
                      Sie erhalten einen Reset-Code per E-Mail
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full"
                  >
                    {isLoading ? 'Wird gesendet...' : 'Reset-Code anfordern'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Reset-Code
                    </label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="000000"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Neuer Zugangscode
                    </label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full"
                  >
                    {isLoading ? 'Wird geändert...' : 'Passwort ändern'}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setResetStep('email');
                  setError(null);
                  setSuccess(null);
                  setResetEmail('');
                  setResetCode('');
                  setResetPassword('');
                }}
                className="w-full text-sm font-medium" style={{color: 'var(--accent)'}}
              >
                ← Zurück zum Login
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>Meyer Decision GmbH</p>
          <p className="mt-1">Steuerungs-Dashboard v6</p>
        </div>
      </div>
    </div>
  );
}
