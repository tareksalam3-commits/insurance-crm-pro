/* ═══════════════════════════════════════════════════════════════
   usePermissions — InsuranceCRM Pro
   مركز صلاحيات كل وظيفة في مكان واحد
═══════════════════════════════════════════════════════════════ */

import type { UserRole } from '../types';

export interface Permissions {
  // ─── شركات ───────────────────────────────────────────────────
  /** يشوف قائمة الشركات */
  canViewAllCompanies: boolean;
  /** يضيف / يعدل / يحذف شركات */
  canManageCompanies: boolean;

  // ─── مستخدمين ────────────────────────────────────────────────
  /** يشوف مستخدمين (قيمته تحدد النطاق: all | own-company | own-team) */
  canViewUsers: boolean;
  /** يضيف / يعدل / يحذف مستخدمين */
  canManageUsers: boolean;
  /** النطاق: 'all' = كل الشركات، 'company' = شركته بس */
  userScope: 'all' | 'company' | 'none';

  // ─── وكلاء ───────────────────────────────────────────────────
  canAddAgent: boolean;
  canEditAgent: boolean;
  canDeleteAgent: boolean;

  // ─── عملاء ───────────────────────────────────────────────────
  canAddClient: boolean;
  canEditClient: boolean;
  canDeleteClient: boolean;
  /** عند تعديل عميل يتبعت إشعار للمدير */
  clientEditNotifiesManager: boolean;

  // ─── تقارير ──────────────────────────────────────────────────
  canViewReports: boolean;
  canEditReports: boolean;
  /** نطاق التقارير */
  reportScope: 'all' | 'company' | 'team' | 'self';

  // ─── طلبات التسجيل ──────────────────────────────────────────
  canViewRequests: boolean;
  canApproveRequests: boolean;
  /** نطاق الطلبات */
  requestScope: 'all' | 'company';

  // ─── Dashboard ───────────────────────────────────────────────
  showFullDashboard: boolean;
  showMyDashboard: boolean;
}

/** الوظائف التي يستطيع كل دور أن يطلب الانضمام إليها */
export const JOINABLE_ROLES_BY_CURRENT: Record<UserRole, UserRole[]> = {
  super_admin:        ['sales_manager', 'general_supervisor', 'supervisor', 'group_leader', 'agent'],
  sales_manager:      ['general_supervisor', 'supervisor', 'group_leader', 'agent'],
  general_supervisor: ['supervisor', 'group_leader', 'agent'],
  supervisor:         ['group_leader', 'agent'],
  group_leader:       ['agent'],
  agent:              [],
};

/** الدور المباشر الأعلى لكل وظيفة (المدير المباشر في التسلسل الهرمي) */
export const MANAGER_ROLE_FOR: Partial<Record<UserRole, UserRole>> = {
  general_supervisor: 'sales_manager',
  supervisor:         'general_supervisor',
  group_leader:       'supervisor',
  agent:              'group_leader',
};

/** حساب الصلاحيات بناءً على الدور */
export function getPermissions(role: UserRole): Permissions {
  switch (role) {
    /* ── Super Admin ─────────────────────────────────────────── */
    case 'super_admin':
      return {
        canViewAllCompanies:        true,
        canManageCompanies:         true,
        canViewUsers:               true,
        canManageUsers:             true,
        userScope:                  'all',
        canAddAgent:                true,
        canEditAgent:               true,
        canDeleteAgent:             true,
        canAddClient:               true,
        canEditClient:              true,
        canDeleteClient:            true,
        clientEditNotifiesManager:  false,
        canViewReports:             true,
        canEditReports:             true,
        reportScope:                'all',
        canViewRequests:            true,
        canApproveRequests:         true,
        requestScope:               'all',
        showFullDashboard:          true,
        showMyDashboard:            false,
      };

    /* ── Sales Manager ───────────────────────────────────────── */
    case 'sales_manager':
      return {
        canViewAllCompanies:        false,
        canManageCompanies:         false,
        canViewUsers:               true,
        canManageUsers:             true,
        userScope:                  'company',
        canAddAgent:                true,
        canEditAgent:               true,
        canDeleteAgent:             true,
        canAddClient:               true,
        canEditClient:              true,
        canDeleteClient:            true,
        clientEditNotifiesManager:  false,
        canViewReports:             true,
        canEditReports:             true,
        reportScope:                'company',
        canViewRequests:            true,
        canApproveRequests:         true,
        requestScope:               'company',
        showFullDashboard:          true,
        showMyDashboard:            false,
      };

    /* ── General Supervisor ──────────────────────────────────── */
    case 'general_supervisor':
      return {
        canViewAllCompanies:        false,
        canManageCompanies:         false,
        canViewUsers:               true,
        canManageUsers:             false,
        userScope:                  'none',       // يشوف المراقبين التابعين ليه فقط
        canAddAgent:                true,
        canEditAgent:               true,
        canDeleteAgent:             false,
        canAddClient:               true,
        canEditClient:              true,
        canDeleteClient:            false,
        clientEditNotifiesManager:  false,
        canViewReports:             true,
        canEditReports:             false,
        reportScope:                'team',        // فريقه بس
        canViewRequests:            true,          // يشوف الطلبات الموجهة إليه
        canApproveRequests:         true,          // يقدر يوافق/يرفض طلبات فريقه
        requestScope:               'company',
        showFullDashboard:          true,
        showMyDashboard:            true,
      };

    /* ── Supervisor ──────────────────────────────────────────── */
    case 'supervisor':
      return {
        canViewAllCompanies:        false,
        canManageCompanies:         false,
        canViewUsers:               true,
        canManageUsers:             false,
        userScope:                  'none',       // رؤساء المجموعات التابعين ليه بس
        canAddAgent:                false,
        canEditAgent:               false,
        canDeleteAgent:             false,
        canAddClient:               true,
        canEditClient:              true,
        canDeleteClient:            false,
        clientEditNotifiesManager:  false,
        canViewReports:             true,
        canEditReports:             false,
        reportScope:                'team',
        canViewRequests:            true,          // يشوف الطلبات الموجهة إليه
        canApproveRequests:         true,          // يقدر يوافق/يرفض طلبات فريقه
        requestScope:               'company',
        showFullDashboard:          true,
        showMyDashboard:            true,
      };

    /* ── Group Leader ────────────────────────────────────────── */
    case 'group_leader':
      return {
        canViewAllCompanies:        false,
        canManageCompanies:         false,
        canViewUsers:               true,
        canManageUsers:             false,
        userScope:                  'none',       // إيجنتس مجموعته بس
        canAddAgent:                false,
        canEditAgent:               false,
        canDeleteAgent:             false,
        canAddClient:               true,
        canEditClient:              false,
        canDeleteClient:            false,
        clientEditNotifiesManager:  false,
        canViewReports:             true,
        canEditReports:             false,
        reportScope:                'team',
        canViewRequests:            false,
        canApproveRequests:         false,
        requestScope:               'company',
        showFullDashboard:          true,
        showMyDashboard:            true,
      };

    /* ── Agent ───────────────────────────────────────────────── */
    case 'agent':
      return {
        canViewAllCompanies:        false,
        canManageCompanies:         false,
        canViewUsers:               false,
        canManageUsers:             false,
        userScope:                  'none',
        canAddAgent:                false,
        canEditAgent:               false,
        canDeleteAgent:             false,
        canAddClient:               true,
        canEditClient:              true,          // بس بيبعت إشعار للمدير
        canDeleteClient:            false,
        clientEditNotifiesManager:  true,          // ← إشعار المدير عند التعديل
        canViewReports:             true,
        canEditReports:             false,
        reportScope:                'self',
        canViewRequests:            false,
        canApproveRequests:         false,
        requestScope:               'company',
        showFullDashboard:          false,
        showMyDashboard:            true,
      };
  }
}

/** هوك للاستخدام في الـ components */
import { useMemo } from 'react';
import { useAuth } from './useAuth';

export function usePermissions(): Permissions {
  const { user } = useAuth();
  return useMemo(
    () => (user ? getPermissions(user.role) : getPermissions('agent')),
    [user?.role]
  );
}
