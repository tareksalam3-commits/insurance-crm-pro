import { useState, useEffect, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signIn, submitRegistrationRequest, getPotentialManagers } from '../services/authService';
import { getCompanies } from '../services/companyService';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { Company, User, UserRole } from '../types';
import { USER_ROLES, ROLE_LABELS } from '../types';

const JOINABLE_ROLES: UserRole[] = ['sales_manager', 'general_supervisor', 'supervisor', 'group_leader', 'agent'];

export default function Login() {
  const { firebaseUser, loading } = useAuth();
  const [tab, setTab] = useState<'login' | 'join'>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Join state
  const [joinName, setJoinName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinCompanyId, setJoinCompanyId] = useState('');
  const [joinRole, setJoinRole] = useState<UserRole>('agent');
  const [joinManagerId, setJoinManagerId] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [joinSubmitted, setJoinSubmitted] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    getCompanies().then((data) => {
      console.log('companies loaded:', data.length, data);
      setCompanies(data);
    }).catch((err) => {
      console.error('companies error:', err);
    });
  }, []);

  useEffect(() => {
    if (!joinCompanyId || !joinRole) {
      setManagers([]);
      setJoinManagerId('');
      return;
    }
    console.log('fetching managers for:', joinCompanyId, joinRole);
    getPotentialManagers(joinCompanyId, joinRole).then((mgrs) => {
      console.log('managers found:', mgrs.length, mgrs);
      setManagers(mgrs);
      setJoinManagerId('');
    }).catch((err) => {
      console.error('managers error:', err);
      setManagers([]);
    });
  }, [joinCompanyId, joinRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }
  if (firebaseUser) return <Navigate to="/" replace />;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await signIn(email, password);
    } catch {
      setLoginError('بريد إلكتروني أو كلمة مرور غير صحيحة');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!joinCompanyId) { setJoinError('اختر الشركة'); return; }
    if (joinRole !== 'sales_manager' && !joinManagerId) { setJoinError('اختر المدير المباشر'); return; }
    setJoinLoading(true);
    setJoinError('');
    try {
      const company = companies.find((c) => c.id === joinCompanyId);
      const manager = managers.find((m) => m.uid === joinManagerId);
      await submitRegistrationRequest({
        displayName: joinName,
        email: joinEmail,
        password: joinPassword,
        companyId: joinCompanyId,
        companyName: company?.name ?? '',
        requestedRole: joinRole,
        managerId: joinManagerId ?? '',
        managerName: manager?.displayName ?? '',
      });
      setJoinSubmitted(true);
    } catch {
      setJoinError('حدث خطأ، حاول مرة أخرى');
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">InsuranceCRM Pro</h1>
          <p className="text-blue-200 mt-1 text-sm">نظام إدارة مبيعات التأمين</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['login', 'join'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'login' ? 'تسجيل الدخول' : 'طلب انضمام'}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── Login Tab ── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pl-12"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit" disabled={loginLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loginLoading && <Loader2 size={16} className="animate-spin" />}
                  {loginLoading ? 'جاري الدخول...' : 'تسجيل الدخول'}
                </button>
              </form>
            )}

            {/* ── Join Tab ── */}
            {tab === 'join' && (
              joinSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Shield size={28} className="text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">طلبك قيد المراجعة</h3>
                  <p className="text-sm text-gray-500">انتظر موافقة المسؤول لتفعيل حسابك</p>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  {joinError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                      {joinError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل</label>
                    <input
                      value={joinName} onChange={(e) => setJoinName(e.target.value)} required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="محمد أحمد"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                    <input
                      type="email" value={joinEmail} onChange={(e) => setJoinEmail(e.target.value)} required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                    <input
                      type="password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} required minLength={6}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="على الأقل 6 أحرف"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الشركة</label>
                    <select
                      value={joinCompanyId} onChange={(e) => setJoinCompanyId(e.target.value)} required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— اختر الشركة —</option>
                      {companies.filter((c) => c.status === 'active').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الوظيفة المطلوبة</label>
                    <select
                      value={joinRole} onChange={(e) => setJoinRole(e.target.value as UserRole)} required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {JOINABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>

                  {managers.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">المدير المباشر</label>
                      <select
                        value={joinManagerId} onChange={(e) => setJoinManagerId(e.target.value)} required
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— اختر المدير —</option>
                        {managers.map((m) => (
                          <option key={m.uid} value={m.uid}>{m.displayName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="submit" disabled={joinLoading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {joinLoading && <Loader2 size={16} className="animate-spin" />}
                    {joinLoading ? 'جاري الإرسال...' : 'إرسال طلب الانضمام'}
                  </button>
                </form>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
