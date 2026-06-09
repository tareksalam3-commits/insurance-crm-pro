/* ═══════════════════════════════════════
   TYPES — InsuranceCRM Pro
═══════════════════════════════════════ */

// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'sales_manager'
  | 'general_supervisor'
  | 'supervisor'
  | 'group_leader'
  | 'agent';

export const USER_ROLES: UserRole[] = [
  'super_admin',
  'sales_manager',
  'general_supervisor',
  'supervisor',
  'group_leader',
  'agent',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:        'مدير عام',
  sales_manager:      'مدير مبيعات',
  general_supervisor: 'مراقب عام',
  supervisor:         'مراقب',
  group_leader:       'رئيس مجموعة',
  agent:              'وكيل',
};

// ─── Production Types ─────────────────────────────────────────────────────────

export type ProductionType =
  | 'agent'
  | 'group_leader'
  | 'supervisor'
  | 'general_supervisor'
  | 'sales_manager';

// ─── Payment Methods ──────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  'شهري',
  'ربع سنوي',
  'نصف سنوي',
  'سنوي',
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

// ─── Month / Year ─────────────────────────────────────────────────────────────

export const MONTH_LIST = [
  'يناير', 'فبراير', 'مارس', 'أبريل',
  'مايو', 'يونيو', 'يوليو', 'أغسطس',
  'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

export const YEAR_LIST = [2024, 2025, 2026, 2027, 2028, 2029, 2030] as const;

// ─── Company ──────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  logo?: string;
  status: 'active' | 'suspended';
  createdAt?: any;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  companyId: string;
  managerId?: string;
  groupId?: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt?: any;
}

// ─── Registration Request ─────────────────────────────────────────────────────

export interface RegistrationRequest {
  id: string;
  displayName: string;
  email: string;
  password?: string; // مؤقت — يُستخدم عند الموافقة ثم يُحذف
  companyId: string;
  companyName: string;
  requestedRole: UserRole;
  managerId: string;
  managerName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  group: string;
  productionType: ProductionType;
  target: number;
  supervisorId?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: any;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  companyId: string;
  agentName: string;
  group: string;
  productionType: ProductionType;
  clientName: string;
  startMonth: string;
  startYear: number;
  annualTarget: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  lastCollectionMonth: string;
  phone?: string;
  policyNumber?: string;
  insuranceCompany?: string;
  insuranceType?: string;
  notes?: string;
  status: 'نشط' | 'متأخر' | 'ملغي';
  createdAt?: any;
}

// ─── Payment Record ───────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  agentName: string;
  group: string;
  amount: number;
  month: string;
  year: number;
  collectedAt: any;
  collectedBy: string;
  notes?: string;
}

// ─── Performance Types ────────────────────────────────────────────────────────

export interface AgentPerformance {
  name: string;
  group: string;
  target: number;
  newProduction: number;
  collection: number;
  totalProduction: number;
  clientsCount: number;
  achievementRate: number;
  productionType: ProductionType;
}

export interface GroupSummary {
  name: string;
  newProd: number;
  coll: number;
  total: number;
  target: number;
  count: number;
  achievementRate: number;
  evaluation: string;
  leaderProduction?: number;
}

export interface LeadershipProduction {
  name: string;
  role: ProductionType;
  newProduction: number;
  collection: number;
  total: number;
  clientsCount: number;
}

export interface UnitSummary {
  newProd: number;
  coll: number;
  total: number;
  target: number;
  achievementRate: number;
  evaluation: string;
  totalAgents: number;
  targetAchievers: number;
  underperformersCount: number;
}

export interface MonthlyReportData {
  month: string;
  year: number;
  performanceMatrix: AgentPerformance[];
  groupSummaries: GroupSummary[];
  unitSummary: UnitSummary;
  champions: AgentPerformance[];
  underperformers: AgentPerformance[];
  leadershipProduction: LeadershipProduction[];
}

// ─── Collection Notification ──────────────────────────────────────────────────

export interface CollectionNotification {
  clientId: string;
  clientName: string;
  agentName: string;
  phone?: string;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  dueMonth: string;
  dueYear: number;
}

// ─── Client Edit Notification (إشعار تعديل العميل من الـ agent) ──────────────

export interface ClientEditNotification {
  id: string;
  type: 'client_edit';
  /** uid المدير الذي يستقبل الإشعار */
  recipientId: string;
  companyId: string;
  clientId: string;
  clientName: string;
  /** اسم الـ agent الذي أجرى التعديل */
  editorName: string;
  /** أسماء الحقول التي تغيرت */
  changedFields: string[];
  /** القيم الجديدة لكل حقل تغير */
  changes: Record<string, any>;
  read: boolean;
  createdAt?: any;
}
