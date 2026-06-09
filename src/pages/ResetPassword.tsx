import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Shield, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const oobCode                 = searchParams.get('oobCode') ?? '';

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [verifying,  setVerifying]  = useState(true);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  // التحقق من صلاحية الـ oobCode عند فتح الصفحة
  useEffect(() => {
    if (!oobCode) {
      setError('الرابط غير صالح. تواصل مع المسؤول.');
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setVerifying(false);
      })
      .catch(() => {
        setError('انتهت صلاحية الرابط أو أنه مستخدم بالفعل. تواصل مع المسؤول لإعادة الإرسال.');
        setVerifying(false);
      });
  }, [oobCode]);

  async function handleSubmit() {
    setError('');
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (password !== confirm) {
      setError('كلمة المرور وتأكيدها غير متطابقتين.');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError('حدث خطأ أثناء تعيين كلمة المرور. حاول مجدداً.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700" dir="rtl">
        <div className="text-white text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p className="text-sm opacity-80">جاري التحقق من الرابط...</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">تم تعيين كلمة المرور!</h2>
          <p className="text-sm text-gray-500">سيتم تحويلك لصفحة تسجيل الدخول تلقائياً...</p>
        </div>
      </div>
    );
  }

  // ── Error (invalid link) ─────────────────────────────────────────────────────
  if (error && !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">رابط غير صالح</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">تعيين كلمة المرور</h1>
          <p className="text-sm text-gray-500 mt-1">{email}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Password */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            كلمة المرور الجديدة <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pl-12"
              placeholder="6 أحرف على الأقل"
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

        {/* Confirm */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            تأكيد كلمة المرور <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConf ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pl-12"
              placeholder="أعد كتابة كلمة المرور"
            />
            <button
              type="button"
              onClick={() => setShowConf(!showConf)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? 'جاري الحفظ...' : 'تعيين كلمة المرور'}
        </button>
      </div>
    </div>
  );
}
