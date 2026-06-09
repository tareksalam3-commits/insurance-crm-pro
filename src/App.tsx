import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/layout/Layout';

import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import MyDashboard from './pages/MyDashboard';
import Clients from './pages/Clients';
import Collections from './pages/Collections';
import Agents from './pages/Agents';
import Reports from './pages/Reports';
import AnnualStats from './pages/AnnualStats';
import Users from './pages/Users';
import Companies from './pages/Companies';
import Requests from './pages/Requests';
import DataDeletion from './pages/DataDeletion';

import type { UserRole } from './types';

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center animate-pulse">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <p className="text-sm text-gray-400">جاري التحميل...</p>
    </div>
  );
}

// ─── Pending Screen ───────────────────────────────────────────────────────────

function PendingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-bold text-gray-900 mb-2">حسابك قيد المراجعة</h2>
        <p className="text-sm text-gray-500">انتظر موافقة المسؤول لتفعيل حسابك</p>
      </div>
    </div>
  );
}

// ─── Forbidden Screen ─────────────────────────────────────────────────────────

function ForbiddenScreen() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <p className="text-sm">غير مصرح لك بعرض هذه الصفحة</p>
    </div>
  );
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { firebaseUser, user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  // حساب معلق — يُعرض شاشة الانتظار بدلاً من إعادة التوجيه
  if (user && user.status === 'pending') return <PendingScreen />;

  // فحص الصلاحية
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <ForbiddenScreen />;
  }

  return <>{children}</>;
}

// ─── App Routes ───────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, permissions } = useAuth();

  // الـ agent يروح مباشرة لـ MyDashboard
  const defaultRoute = user?.role === 'agent' ? '/my-dashboard' : '/';

  return (
    <Routes>
      {/* صفحة علنية — لا تحتاج دخول */}
      <Route path="/data-deletion" element={<DataDeletion />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard الرئيسي — كل الأدوار ما عدا agent */}
        <Route
          index
          element={
            user?.role === 'agent'
              ? <Navigate to="/my-dashboard" replace />
              : <Dashboard />
          }
        />

        {/* My Dashboard — agent + القيادات اللي عندها إنتاج شخصي */}
        <Route
          path="my-dashboard"
          element={
            permissions.showMyDashboard
              ? <MyDashboard />
              : <Navigate to="/" replace />
          }
        />

        {/* عملاء — كل الأدوار اللي عندها canAddClient أو canViewReports */}
        <Route path="clients" element={<Clients />} />

        {/* تحصيلات */}
        <Route path="collections" element={<Collections />} />

        {/* وكلاء — sales_manager, general_supervisor فقط يقدروا يضيفوا/يعدلوا */}
        <Route path="agents" element={<Agents />} />

        {/* تقارير */}
        <Route path="reports" element={<Reports />} />

        {/* إحصائيات سنوية */}
        <Route path="annual" element={<AnnualStats />} />

        {/* مستخدمين — super_admin و sales_manager فقط */}
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'sales_manager']}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* طلبات التسجيل — super_admin و sales_manager فقط */}
        <Route
          path="requests"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'sales_manager']}>
              <Requests />
            </ProtectedRoute>
          }
        />

        {/* شركات — super_admin فقط */}
        <Route
          path="companies"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Companies />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
