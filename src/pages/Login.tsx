import { useState, useEffect, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signIn, submitRegistrationRequest } from '../services/authService';
import { getCompanies } from '../services/companyService';
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, Phone, Lock, User, Mail, Building2 } from 'lucide-react';
import type { Company, UserRole } from '../types';
import { ROLE_LABELS } from '../types';

// الأدوار التي يُسمح لها بطلب الانضمام (الوكيل يختار الشركة فقط)
const JOINABLE_ROLES: UserRole[] = [
  'sales_manager',
  'general_supervisor',
  'supervisor',
  'group_leader',
  'agent',
];

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'بريد إلكتروني أو كلمة مرور غير صحيحة';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد المحاولات، حاول بعد قليل';
    case 'auth/user-disabled':
      return 'هذا الحساب موقوف، تواصل مع المسؤول';
    default:
      return 'حدث خطأ، حاول مرة أخرى';
  }
}

export default function Login() {
  const { firebaseUser, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'join'>('login');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode    = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'resetPassword' && oobCode) {
      navigate(`/reset-password?oobCode=${oobCode}`, { replace: true });
    }
  }, [navigate]);

  // ── Login state ───────────────────────────────────────────────────────────
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [loginError,   setLoginError]   = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Join state ────────────────────────────────────────────────────────────
  const [joinName,      setJoinName]      = useState('');
  const [joinEmail,     setJoinEmail]     = useState('');
  const [joinPhone,     setJoinPhone]     = useState('');
  const [joinPassword,  setJoinPassword]  = useState('');
  const [joinConfirm,   setJoinConfirm]   = useState('');
  const [showJoinPwd,   setShowJoinPwd]   = useState(false);
  const [joinCompanyId, setJoinCompanyId] = useState('');
  const [joinRole,      setJoinRole]      = useState<UserRole>('agent');
  const [companies,     setCompanies]     = useState<Company[]>([]);
  const [joinSubmitted, setJoinSubmitted] = useState(false);
  const [joinError,     setJoinError]     = useState('');
  const [joinLoading,   setJoinLoading]   = useState(false);

  useEffect(() => {
    getCompanies()
      .then((data) => setCompanies(data.filter((c) => c.status === 'active')))
      .catch(() => setCompanies([]));
  }, []);

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
    } catch (err: any) {
      setLoginError(mapFirebaseError(err?.code ?? ''));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setJoinError('');

    if (!joinName.trim())        { setJoinError('الاسم الكامل مطلوب'); return; }
    if (!joinEmail.trim())       { setJoinError('البريد الإلكتروني مطلوب'); return; }
    if (!joinPhone.trim())       { setJoinError('رقم الهاتف مطلوب'); return; }
    if (!joinPassword)           { setJoinError('كلمة المرور مطلوبة'); return; }
    if (joinPassword.length < 6) { setJoinError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (joinPassword !== joinConfirm) { setJoinError('كلمة المرور وتأكيدها غير متطابقتين'); return; }
    if (!joinCompanyId)          { setJoinError('اختر الشركة'); return; }
    if (!joinRole)               { setJoinError('اختر الوظيفة'); return; }

    setJoinLoading(true);
    try {
      const company = companies.find((c) => c.id === joinCompanyId);
      await submitRegistrationRequest({
        displayName:   joinName.trim(),
        email:         joinEmail.trim(),
        phone:         joinPhone.trim(),
        password:      joinPassword,
        companyId:     joinCompanyId,
        companyName:   company?.name ?? '',
        requestedRole: joinRole,
      });
      setJoinSubmitted(true);
    } catch {
      setJoinError('حدث خطأ أثناء الإرسال، حاول مرة أخرى');
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4"
      dir="rtl"
    >
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

            {/* ══ Login Tab ════════════════════════════════════════════════ */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full pr-10 pl-10 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loginLoading && <Loader2 size={16} className="animate-spin" />}
                  {loginLoading ? 'جاري الدخول...' : 'تسجيل الدخول'}
                </button>
              </form>
            )}

            {/* ══ Join Tab ══════════════════════════════════════════════════ */}
            {tab === 'join' && (
              joinSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">تم إرسال طلبك بنجاح!</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    طلبك قيد المراجعة من المراقب العام.
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    بعد الموافقة يمكنك تسجيل الدخول بكلمة المرور التي أنشأتها.
                  </p>
                  <button
                    onClick={() => { setJoinSubmitted(false); setTab('login'); }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    العودة لتسجيل الدخول
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  {joinError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                      {joinError}
                    </div>
                  )}

                  {/* الاسم الكامل */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      الاسم الكامل <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        required
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="محمد أحمد"
                      />
                    </div>
                  </div>

                  {/* البريد الإلكتروني */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      البريد الإلكتروني <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        required
                        autoComplete="off"
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  {/* رقم الهاتف */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      رقم الهاتف <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={joinPhone}
                        onChange={(e) => setJoinPhone(e.target.value)}
                        required
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="201012345678"
                      />
                    </div>
                  </div>

                  {/* كلمة المرور */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      كلمة المرور <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showJoinPwd ? 'text' : 'password'}
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="w-full pr-10 pl-10 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="6 أحرف على الأقل"
                      />
                      <button
                        type="button"
                        onClick={() => setShowJoinPwd(!showJoinPwd)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showJoinPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* تأكيد كلمة المرور */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      تأكيد كلمة المرور <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showJoinPwd ? 'text' : 'password'}
                        value={joinConfirm}
                        onChange={(e) => setJoinConfirm(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={`w-full pr-10 pl-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          joinConfirm && joinConfirm !== joinPassword
                            ? 'border-red-300 bg-red-50'
                            : joinConfirm && joinConfirm === joinPassword
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-gray-300'
                        }`}
                        placeholder="••••••••"
                      />
                      {joinConfirm && joinConfirm === joinPassword && (
                        <CheckCircle2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  {/* الشركة */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      الشركة <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={joinCompanyId}
                        onChange={(e) => setJoinCompanyId(e.target.value)}
                        required
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="">— اختر الشركة —</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    {companies.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin" /> جاري تحميل الشركات...
                      </p>
                    )}
                  </div>

                  {/* الوظيفة */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      الوظيفة المطلوبة <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={joinRole}
                      onChange={(e) => setJoinRole(e.target.value as UserRole)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {JOINABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>

                  {/* ملاحظة توضيحية */}
                  <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                    <span className="mt-0.5 flex-shrink-0">ℹ️</span>
                    <span>
                      بعد مراجعة الطلب، سيقوم المراقب العام بتعيين المراقب ورئيس المجموعة المناسبين لك.
                      يمكنك تسجيل الدخول فور الموافقة بكلمة المرور التي أنشأتها.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={joinLoading}
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
