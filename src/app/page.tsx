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
  };dth: 52, height: 52, borderRadius: 12,
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
              <div className="space-y2 text-sm text-center">
                <button
                  type="button"
                  onClick={() => {
                    setView('reset');
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{display: 'block', width: '100%', fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem'}}
                >
                  Passwort vergessen?
                </button>
                <div style={{paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)'}}>
                  <p style={{marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem'}}>Noch nicht registriert?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setView('register');
                      setError(null);
                      setSuccess(null);
                    }}
                    style={{fontWeight: 600, color: 'var(--copper)', background: 'none', border: 'none', fontSize: '0.875rem'}}
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
                  placeholder="ihreA�����������(������������������ɕ�եɕ�(��������������������ͅ��������1�������(������������������(��������������𽑥��((�����������������(����������������񱅉��������9���􉉱����ѕ�еʹ����е����մ����Ȉ�(������������������Y�����������ȁ9���(����������������𽱅����(��������������������(�����������������������ѕ�Ј(������������������م�Ք��ɕ���ѕ�9����(��������������������
������졔�����͕�I����ѕ�9������хɝ�йم�Ք��(������������������������������5���5��ѕɵ����(������������������ɕ�եɕ�(��������������������ͅ��������1�������(������������������(��������������𽑥��((�����������������(����������������񱅉��������9���􉉱����ѕ�еʹ����е����մ����Ȉ�(�������������������ɵ�(����������������𽱅����(��������������������(�����������������������ѕ�Ј(������������������م�Ք��ɕ���ѕ��ɵ��(��������������������
������졔�����͕�I����ѕ��ɵ����хɝ�йم�Ք��(������������������������������5��ѕɵ������ �(������������������ɕ�եɕ�(��������������������ͅ��������1�������(������������������(��������������𽑥��((�����������������(����������������񱅉��������9���􉉱����ѕ�еʹ����е����մ����Ȉ�(������������������A���ݽ�Ё������(����������������𽱅����(��������������������(���������������������������ݽɐ�(������������������م�Ք��ɕ���ѕ�A���ݽɑ�(��������������������
������졔�����͕�I����ѕ�A���ݽɐ���хɝ�йم�Ք��(�����������������������������������������������(������������������ɕ�եɕ�(��������������������ͅ��������1�������(������������������(������������������������9����ѕ�е�́�дĈ���屔��퍽���耝مȠ��ѕ�е͕������䤝���(������������������5�����ѕ�̀��i������(�������������������(��������������𽑥��((���������������؁��屔����������耜����ɕ������ɑ��I������ఁ�����ɽչ�耝ɝ�����ذ�����ذ���ज����ɑ��耜����ͽ����ɝ�����ذ�����ذ��Ȥ����(���������������������屔��홽��M��耜����ɕ���������耝مȠ��ѕ�е͕������䤝���(������������������%�ɔ�I�����ɥ��չ��ݥɐ�ٽ��������������Ʌѽȁ�����и(�������������������(��������������𽑥��((�����������������ѽ�(����������������������Չ��Ј(������������������ͅ��������1�������(���������������������9����Ѹ��ɥ����ܵ�ձ��(���������������(�������������������1����������]�ɐ�ٕɅɉ��ѕи����耝I�����ɥ��չ����͕������(�����������������ѽ��((�����������������ѽ�(�����������������������ѽ��(������������������
�����젤�����(������������������͕�Y��ܠ���������(������������������͕��ɽȡ�ձ���(������������������͕�MՍ���̡�ձ���(������������������͕�I����ѕ����������(������������������͕�I����ѕ�9��������(������������������͕�I����ѕ��ɵ������(������������������͕�I����ѕ�A���ݽɐ�����(������������������(������������������屔���ݥ�Ѡ耜�����������M��耜�����ɕ��������]����������������耝مȠ�������Ȥ��������ɽչ�耝���������ɑ��耝�������(���������������(�����������������@�i��񍬁�մ�1����(�����������������ѽ��(������������𽙽ɴ�(������������((����������켨�A���ݽɐ�I�͕ЁY��܀���(�����������٥�܀���ɕ͕М�����(�������������ɴ(����������������MՉ�����ɕ͕�Mѕ����􀝕��������������I��Օ��I�͕Ѐ聡�����
����ɵI�͕��(�������������������9�����������Ј(�������������(���������������ɕ͕�Mѕ����􀝕���������(������������������(���������������������(��������������������񱅉��������9���􉉱����ѕ�еʹ����е����մ����Ȉ�(�����������������������5�����ɕ�͔(��������������������𽱅����(������������������������(��������������������������􉕵����(����������������������م�Ք��ɕ͕������(������������������������
������졔�����͕�I�͕��������хɝ�йم�Ք��(���������������������������������􉥡ɕ����������(����������������������ɕ�եɕ�(������������������������ͅ��������1�������(����������������������(����������������������������9����ѕ�е�́�дĈ���屔��퍽���耝مȠ��ѕ�е͕������䤝���(����������������������M����ɡ��ѕ��������I�͕е
������ȁ�5���(�����������������������(������������������𽑥��((���������������������ѽ�(��������������������������Չ��Ј(����������������������ͅ��������1�������(�������������������������9����Ѹ��ɥ����ܵ�ձ��(�������������������(�����������������������1����������]�ɐ���͕���и����耝I�͕е
��������ɑ�ɸ��(���������������������ѽ��(������������������(����������������耠(������������������(���������������������(��������������������񱅉��������9���􉉱����ѕ�еʹ����е����մ����Ȉ�(����������������������I�͕е
���(��������������������𽱅����(������������������������(���������������������������ѕ�Ј(����������������������م�Ք��ɕ͕�
����(������������������������
������졔�����͕�I�͕�
������хɝ�йم�Ք��(�����������������������������������������(����������������������ɕ�եɕ�(������������������������ͅ��������1�������(����������������������(������������������𽑥��((���������������������(��������������������񱅉��������9���􉉱����ѕ�еʹ����е����մ����Ȉ�(����������������������9�Օȁi՝���͍���(��������������������𽱅����(������������������������(�������������������������������ݽɐ�(����������������������م�Ք��ɕ͕�A���ݽɑ�(������������������������
������졔�����͕�I�͕�A���ݽɐ���хɝ�йم�Ք��(����������������������������������������������������\]Z\�Y�\�X�Y^�\��Y[��B�ς��]�����]ۂ�\OH��X�Z]��\�X�Y^�\��Y[��B��\�Ә[YOH���\�[X\�H�Y�[�����\��Y[���	��\��p��\������	�\���ܝ0��\���B�؝]ۏ��ς�
_B���]ۂ�\OH��]ۈ��ې�X��^�
HO��]�Y]�	���[��N�]�\�]�\
	�[XZ[	�N�]\��܊�[
N�]�X��\���[
N�]�\�][XZ[
	��N�]�\�]��J	��N�]�\�]\���ܙ
	��N_B��[O^���Y�	�L	I��۝�^�N�	��
�\�[I��۝�ZY��
���܎�	ݘ\�KX��\�I��X��ܛ�[��	ۛۙI��ܙ\��	ۛۙI�_B���8���\�����[H��[��؝]ۏ��ٛܛO��
_B��]�����ʈ���\�
��B�]��[O^��^[Yێ�	��[�\��X\��[���	�K�\�[I���܎�	ݘ\�K]^\�X�ۙ\�JI��۝�^�N�	���\�[I�_O���Y^Y\�X�\�[ۈ�X�0���]Y\�[���Q\���\�������]����]����]���
NB
