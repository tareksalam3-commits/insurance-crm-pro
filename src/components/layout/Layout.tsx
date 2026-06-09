import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, FileBarChart, LogOut,
  Menu, X, Wallet, BarChart3, UserCircle2, Bell, Building2,
  ClipboardList, Shield,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { signOut, subscribeToRegistrationRequests } from '../../services/authService';
import { subscribeToClients } from '../../services/clientService';
import { MONTH_LIST, ROLE_LABELS } from '../../types';
import { isCollectionMonth, isNewProductionMonth } from '../../services/paymentService';
import type { Client } from '../../types';

export function Layout() {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);

  // إشعارات التحصيل
  useEffect(() => {
    if (!user?.companyId) return;
    const unsub = subscribeToClients(
      (data) => {
        const currentMonth = MONTH_LIST[new Date().getMonth()];
        const currentYear  = new Date().getFullYear();
        const count = data.filter(
          (c) =>
            c.status !== 'ملغي' &&
            (
              isCollectionMonth(c, currentMonth, currentYear) ||
              isNewProductionMonth(c, currentMonth, currentYear)
            )
        ).length;
        setDueCount(count);
      },
      user.companyId,
      user.role === 'agent' ? { agentId: user.uid } : undefined
    );
    return unsub;
  }, [user?.companyId, user?.role, user?.uid]);

  // إشعارات طلبات الانضمام — للمديرين فقط
  useEffect(() => {
    if (!permissions.canApproveRequests || !user?.companyId) return;
    const companyFilter = user.role === 'super_admin' ? undefined : user.companyId;
    const unsub = subscribeToRegistrationRequests(
      (data) => setRequestsCount(data.length),
      companyFilter
    );
    return unsub;
  }, [permissions.canApproveRequests, user?.role, user?.companyId]);

  const role = user?.role ?? 'agent';
  const totalBadge = dueCount + requestsCount;

  // ── Nav items ──────────────────────────────────────────────────────────────
  const navItems = [
    {
      to: '/',
      label: 'لوحة التحكم',
      icon: LayoutDashboard,
      show: permissions.showFullDashboard,
    },
    {
      to: '/my-dashboard',
      label: 'أدائي',
      icon: UserCircle2,
      show: permissions.showMyDashboard,
    },
    {
      to: '/clients',
      label: 'العملاء',
      icon: Users,
      show: permissions.canAddClient || permissions.canViewReports,
    },
    {
      to: '/collections',
      label: 'التحصيل',
      icon: Wallet,
      show: true,
      badge: dueCount > 0 ? dueCount : null,
    },
    {
      to: '/agents',
      label: 'الوكلاء',
      icon: UserCheck,
      show: ['sales_manager', 'general_supervisor', 'supervisor', 'group_leader'].includes(role),
    },
    {
      to: '/reports',
      label: 'التقارير',
      icon: FileBarChart,
      show: permissions.canViewReports && permissions.reportScope !== 'self',
    },
    {
      to: '/annual',
      label: 'الإحصائيات السنوية',
      icon: BarChart3,
      show: permissions.reportScope === 'all' || permissions.reportScope === 'company',
    },
    {
      to: '/users',
      label: 'المستخدمين',
      icon: Shield,
      show: permissions.canManageUsers,
    },
    {
      to: '/requests',
      label: 'طلبات الانضمام',
      icon: ClipboardList,
      show: permissions.canApproveRequests,
      badge: requestsCount > 0 ? requestsCount : null,
    },
    {
      to: '/companies',
      label: 'الشركات',
      icon: Building2,
      show: permissions.canManageCompanies,
    },
  ];

  const visible = navItems.filter((item) => item.show);

  const closeSidebar = () => setSidebarOpen(false);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 w-72 bg-white border-l border-gray-100 shadow-xl transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center">
                  <Shield size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">InsuranceCRM Pro</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[role]}</p>
                </div>
              </div>
              <button
                onClick={closeSidebar}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* User info */}
          <div className="px-4 py-3 bg-blue-50 mx-4 mt-4 rounded-xl">
            <p className="font-semibold text-gray-900 text-sm truncate">{user?.displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg mt-1 inline-block">
              {ROLE_LABELS[role]}
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <item.icon size={18} className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </aside>

      {/* Header — بيبدأ تحت شريط الحالة */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">InsuranceCRM Pro</span>
          </div>

          <div className="relative">
            <button
              onClick={() => navigate(requestsCount > 0 ? '/requests' : '/collections')}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors relative"
            >
              <Bell size={20} />
              {totalBadge > 0 && (
                <span className="absolute -top-0.5 -left-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {totalBadge > 9 ? '9+' : totalBadge}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main
        className="p-4 pb-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>
    </div>
  );
}
