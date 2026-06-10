import { useState, useEffect, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signIn, submitRegistrationRequest, getPotentialManagers } from '../services/authService';
import { getCompanies } from '../services/companyService';
import { Shield, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import type { Company, User, UserRole } from '../types';
import { ROLE_LABELS } from '../types';

// الأدوار التي يُسمح لها بطلب الانضمام
const JOINABLE_ROLES: UserRole[] = [
  'sales_manager',
  'general_supervisor',
  'supervisor',
  'group_leader',
  'agent',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const { firebaseUser, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'join'>('login');

  // ── إعادة توجيه Firebase action URLs (reset password) ─────────────────────
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
  const [joinName,              setJoinName]              = useState('');
  const [joinEmail,             setJoinEmail]             = useState('');
  const [joinCompanyId,         setJoinCompanyId]         = useState('');
  const [joinRole,              setJoinRole]              = useState<UserRole>('agent');
  
  // السلسلة الهرمية الكاملة
  const [joinGeneralSupervisorId, setJoinGeneralSupervisorId] = useState('');
  const [joinSupervisorId,        setJoinSupervisorId]        = useState('');
  const [joinGroupLeaderId,       setJoinGroupLeaderId]       = useState('');
  
  const [companies,              setCompanies]              = useState<Company[]>([]);
  const [generalSupervisors,     setGeneralSupervisors]     = useState<User[]>([]);
  const [supervisors,            setSupervisors]            = useState<User[]>([]);
  const [groupLeaders,           setGroupLeaders]           = useState<User[]>([]);
  
  const [companiesLoading,          setCompaniesLoading]          = useState(true);
  const [generalSupervisorsLoading, setGeneralSupervisorsLoading] = useState(false);
  const [supervisorsLoading,        setSupervisorsLoading]        = useState(false);
  const [groupLeadersLoading,       setGroupLeadersLoading]       = useState(false);
  
  const [joinSubmitted,  setJoinSubmitted]  = useState(false);
  const [joinError,      setJoinError]      = useState('');
  const [joinLoading,    setJoinLoading]    = useState(false);

  // ── Load companies once ───────────────────────────────────────────────────
  useEffect(() => {
    setCompaniesLoading(true);
    getCompanies()
      .then((data) => {
        const active = data.filter((c) => c.status === 'active');
        setCompanies(active);
      })
      .catch((err) => {
        console.error('خطأ في تحميل الشركات:', err);
        setCompanies([]);
      })
      .finally(() => setCompaniesLoading(false));
  }, []);

  // ── Load general supervisors when company changes ──────────────────────────
  useEffect(() => {
    setJoinGeneralSupervisorId('');
    setGeneralSupervisors([]);
    setJoinSupervisorId('');
    setSupervisors([]);
    setJoinGroupLeaderId('');
    setGroupLeaders([]);

    if (!joinCompanyId) return;

    setGeneralSupervisorsLoading(true);
    getPotentialManagers(joinCompanyId, 'general_supervisor')
      .then((mgrs) => {
        console.log('المراقبون العاميون:', mgrs);
        setGeneralSupervisors(mgrs);
      })
      .catch((err) => {
        console.error('خطأ في تحميل المراقبين العاميين:', err);
        setGeneralSupervisors([]);
      })
      .finally(() => setGeneralSupervisorsLoading(false));
  }, [joinCompanyId]);

  // ── Load supervisors when company changes ───────────────────────
  useEffect(() => {
    setJoinSupervisorId('');
    setSupervisors([]);
    setJoinGroupLeaderId('');
    setGroupLeaders([]);

    if (!joinCompanyId) return;

    setSupervisorsLoading(true);
    getPotentialManagers(joinCompanyId, 'supervisor')
      .then((mgrs) => {
        console.log('المراقبون المتاحون:', mgrs);
        setSupervisors(mgrs);
      })
      .catch((err) => {
        console.error('خطأ في تحميل المراقبين:', err);
        setSupervisors([]);
      })
      .finally(() => setSupervisorsLoading(false));
  }, [joinCompanyId]);

  // ── Load group leaders when company changes ─────────────────────────────
  useEffect(() => {
    setJoinGroupLeaderId('');
    setGroupLeaders([]);

    if (!joinCompanyId) return;

    setGroupLeadersLoading(true);
    getPotentialManagers(joinCompanyId, 'group_leader')
      .then((mgrs) => {
        console.log('رؤساء المجموعات المتاحون:', mgrs);
        setGroupLeaders(mgrs);
      })
      .catch((err) => {
        console.error('خطأ في تحميل رؤساء المجموعات:', err);
        setGroupLeaders([]);
      })
      .finally(() => setGroupLeadersLoading(false));
  }, [joinCompanyId]);

  // ── Redirect if already logged in ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }
  if (firebaseUser) return <Navigate to="/" replace />;

  // ── Handlers ──────────────────────────────────────────────────────────────

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

    // Validation - الحقول الإجبارية فقط
    if (!joinName.trim())      { setJoinError('الاسم الكامل مطلوب'); return; }
    if (!joinEmail.trim())     { setJoinError('البريد الإلكتروني مطلوب'); return; }
    if (!joinCompanyId)        { setJoinError('اختر الشركة'); return; }
    if (!joinRole)             { setJoinError('اختر الوظيفة'); return; }
    
    // المديرون اختياريون - ناخذ أي مدير متاح أو نتخطى المستويات

    setJoinLoading(true);
    try {
      const company = companies.find((c) => c.id === joinCompanyId);
      let managerId = '';
      let managerName = '';

      // تحديد المدير المباشر حسب الدور - ناخذ أي متاح
      if (joinRole === 'agent') {
        if (joinGroupLeaderId) {
          managerId = joinGroupLeaderId;
          const leader = groupLeaders.find((l) => l.uid === joinGroupLeaderId);
          managerName = leader?.displayName ?? '';
        } else if (joinSupervisorId) {
          managerId = joinSupervisorId;
          const supervisor = supervisors.find((s) => s.uid === joinSupervisorId);
          managerName = supervisor?.displayName ?? '';
        } else if (joinGeneralSupervisorId) {
          managerId = joinGeneralSupervisorId;
          const generalSupervisor = generalSupervisors.find((g) => g.uid === joinGeneralSupervisorId);
          managerName = generalSupervisor?.displayName ?? '';
        }
      } else if (joinRole === 'group_leader') {
        if (joinSupervisorId) {
          managerId = joinSupervisorId;
          const supervisor = supervisors.find((s) => s.uid === joinSupervisorId);
          managerName = supervisor?.displayName ?? '';
        } else if (joinGeneralSupervisorId) {
          managerId = joinGeneralSupervisorId;
          const generalSupervisor = generalSupervisors.find((g) => g.uid === joinGeneralSupervisorId);
          managerName = generalSupervisor?.displayName ?? '';
        }
      } else if (joinRole === 'supervisor') {
        if (joinGeneralSupervisorId) {
          managerId = joinGeneralSupervisorId;
          const generalSupervisor = generalSupervisors.find((g) => g.uid === joinGeneralSupervisorId);
          managerName = generalSupervisor?.displayName ?? '';
        }
      }

      await submitRegistrationRequest({
        displayName:   joinName.trim(),
        email:         joinEmail.trim(),
        companyId:     joinCompanyId,
        companyName:   company?.name ?? '',
        requestedRole: joinRole,
        managerId:     managerId,
        managerName:   managerName,
      });
      setJoinSubmitted(true);
    } catch (err) {
      console.error('خطأ في إرسال الطلب:', err);
      setJoinError('حدث خطأ أثناء الإرسال، حاول مرة أخرى');
    } finally {
      setJoinLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pl-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
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

            {/* ══ Join Tab ═════════════════════════════════════════════════ */}
            {tab === 'join' && (
              <>
                {joinSubmitted ? (
                  /* ── Success State ── */
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} className="text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">تم إرسال طلبك بنجاح!</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      طلبك قيد المراجعة، انتظر موافقة المسؤول لتفعيل حسابك.
                    </p>
                    <button
                      onClick={() => { setJoinSubmitted(false); setTab('login'); }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      العودة لتسجيل الدخول
                    </button>
                  </div>
                ) : (
                  /* ── Join Form ── */
                  <form onSubmit={handleJoin} className="space-y-4 max-h-[600px] overflow-y-auto">

                    {joinError && (
                      <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                        {joinError}
                      </div>
                    )}

                    {/* 1. الاسم الكامل */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        الاسم الكامل <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="محمد أحمد"
                      />
                    </div>

                    {/* 2. البريد الإلكتروني */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        البريد الإلكتروني <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        required
                        autoComplete="off"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>

                    {/* 3. ملاحظة كلمة المرور */}
                    <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                      <span className="mt-0.5">ℹ️</span>
                      <span>بعد موافقة المسؤول على طلبك، ستصلك رسالة بريد إلكتروني لتعيين كلمة المرور الخاصة بك.</span>
                    </div>

                    {/* 4. الشركة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        الشركة <span className="text-red-500">*</span>
                      </label>
                      {companiesLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-400">
                          <Loader2 size={14} className="animate-spin" />
                          جاري تحميل الشركات...
                        </div>
                      ) : companies.length === 0 ? (
                        <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
                          لا توجد شركات متاحة حالياً.
                        </div>
                      ) : (
                        <select
                          value={joinCompanyId}
                          onChange={(e) => setJoinCompanyId(e.target.value)}
                          required
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— اختر الشركة —</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* 5. الوظيفة */}
                    {joinCompanyId && (
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
                    )}

                    {/* 6. المراقب العام */}
                    {joinCompanyId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          المراقب العام
                        </label>
                        {generalSupervisorsLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" />
                            جاري البحث...
                          </div>
                        ) : generalSupervisors.length === 0 ? (
                          <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
                            لا يوجد مراقب عام متاح في الشركة المختارة.
                          </div>
                        ) : (
                          <select
                            value={joinGeneralSupervisorId}
                            onChange={(e) => setJoinGeneralSupervisorId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— اختر المراقب العام (اختياري) —</option>
                            {generalSupervisors.map((g) => (
                              <option key={g.uid} value={g.uid}>{g.displayName}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* 7. المراقب */}
                    {joinCompanyId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          المراقب
                        </label>
                        {supervisorsLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" />
                            جاري البحث...
                          </div>
                        ) : supervisors.length === 0 ? (
                          <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
                            لا يوجد مراقب متاح.
                          </div>
                        ) : (
                          <select
                            value={joinSupervisorId}
                            onChange={(e) => setJoinSupervisorId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— اختر المراقب (اختياري) —</option>
                            {supervisors.map((s) => (
                              <option key={s.uid} value={s.uid}>{s.displayName}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* 8. رئيس المجموعة */}
                    {joinCompanyId && (joinRole === 'agent' || joinRole === 'group_leader' || joinRole === 'supervisor') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          رئيس المجموعة <span className="text-red-500">*</span>
                        </label>
                        {groupLeadersLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" />
                            جاري البحث...
                          </div>
                        ) : groupLeaders.length === 0 ? (
                          <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
                            لا يوجد رئيس مجموعة متاح تحت هذا المراقب.
                          </div>
                        ) : (
                          <select
                            value={joinGroupLeaderId}
                            onChange={(e) => setJoinGroupLeaderId(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— اختر رئيس المجموعة —</option>
                            {groupLeaders.map((l) => (
                              <option key={l.uid} value={l.uid}>{l.displayName}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={joinLoading}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {joinLoading && <Loader2 size={16} className="animate-spin" />}
                      {joinLoading ? 'جاري الإرسال...' : 'إرسال طلب الانضمام'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
