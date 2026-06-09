import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Shield, Search, Building2 } from 'lucide-react';
import { useUsers, useCompanies } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { ROLE_LABELS } from '../types';
import type { User, UserRole } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<User['status'], string> = {
  active:    'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<User['status'], string> = {
  active:    'نشط',
  pending:   'معلق',
  suspended: 'موقوف',
};

/**
 * الأدوار التي يُسمح لكل دور بإنشائها أو تعديلها.
 * super_admin  → كل الأدوار
 * sales_manager → كل الأدوار ما عدا super_admin
 */
const ALLOWED_ROLES_TO_CREATE: Record<string, UserRole[]> = {
  super_admin:   ['sales_manager', 'general_supervisor', 'supervisor', 'group_leader', 'agent'],
  sales_manager: ['general_supervisor', 'supervisor', 'group_leader', 'agent'],
};

const EMPTY_FORM = {
  email:       '',
  password:    '',
  displayName: '',
  role:        'agent' as UserRole,
  companyId:   '',
  managerId:   '',
  status:      'active' as User['status'],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Users() {
  const { user: currentUser, permissions } = useAuth();
  const { companies } = useCompanies();

  // super_admin يقدر يفلتر بين الشركات، غيره مقيد بشركته
  const [selectedCompany, setSelectedCompany] = useState<string>(
    currentUser?.role === 'super_admin' ? '' : currentUser?.companyId ?? ''
  );

  const { users, loading, create, update, remove } = useUsers(
    selectedCompany || undefined
  );

  const [search,      setSearch]      = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [editUid,     setEditUid]     = useState<string | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [deleteUid,   setDeleteUid]   = useState<string | null>(null);
  const [deleteUser,  setDeleteUser]  = useState<User | null>(null);

  // ── الصلاحية ──────────────────────────────────────────────────────────────
  const canManage = permissions.canManageUsers; // true فقط لـ super_admin و sales_manager

  // الأدوار المسموح للمستخدم الحالي إنشاؤها
  const creatableRoles: UserRole[] = useMemo(
    () => ALLOWED_ROLES_TO_CREATE[currentUser?.role ?? ''] ?? [],
    [currentUser?.role]
  );

  // ── فلترة البحث ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  // ── مجموعة الشركات المتاحة في الـ Modal ─────────────────────────────────
  const availableCompanies = useMemo(() => {
    if (currentUser?.role === 'super_admin') return companies;
    return companies.filter((c) => c.id === currentUser?.companyId);
  }, [companies, currentUser]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openAdd() {
    setEditUid(null);
    setForm({
      ...EMPTY_FORM,
      companyId: selectedCompany || currentUser?.companyId || '',
      role: creatableRoles[creatableRoles.length - 1] ?? 'agent', // agent كافتراضي
    });
    setError('');
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUid(u.uid);
    setForm({
      email:       u.email,
      password:    '',
      displayName: u.displayName,
      role:        u.role,
      companyId:   u.companyId,
      managerId:   u.managerId ?? '',
      status:      u.status,
    });
    setError('');
    setShowModal(true);
  }

  function openDelete(u: User) {
    setDeleteUid(u.uid);
    setDeleteUser(u);
  }

  async function handleSubmit() {
    // ── Validation ──────────────────────────────────────────────────────────
    if (!form.displayName.trim())              { setError('الاسم مطلوب'); return; }
    if (!editUid && !form.email.trim())        { setError('البريد الإلكتروني مطلوب'); return; }
    if (!editUid && form.password.length < 6)  { setError('كلمة المرور 6 أحرف على الأقل'); return; }
    if (!form.companyId)                       { setError('اختر الشركة'); return; }

    // التحقق أن الدور المختار ضمن الصلاحيات
    if (!creatableRoles.includes(form.role)) {
      setError('غير مسموح لك بإنشاء مستخدم بهذا الدور');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (editUid) {
        // التعديل: اسم + دور + حالة (لا يُغيَّر الإيميل أو الباسورد هنا)
        await update(editUid, {
          displayName: form.displayName,
          role:        form.role,
          status:      form.status,
          ...(form.managerId ? { managerId: form.managerId } : {}),
        });
      } else {
        // الإنشاء
        await create({
          email:       form.email,
          password:    form.password,
          displayName: form.displayName,
          role:        form.role,
          companyId:   form.companyId,
          ...(form.managerId ? { managerId: form.managerId } : {}),
        });
      }
      setShowModal(false);
    } catch (e: any) {
      setError(e?.message ?? 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteUid) return;
    await remove(deleteUid);
    setDeleteUid(null);
    setDeleteUser(null);
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
        <Shield size={40} className="opacity-30" />
        <p className="text-sm">غير مصرح لك بعرض هذه الصفحة</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">
          المستخدمين
          <span className="mr-2 text-sm font-normal text-gray-400">({filtered.length})</span>
        </h1>
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
          إضافة مستخدم
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {/* فلتر الشركة — super_admin فقط */}
        {currentUser?.role === 'super_admin' && (
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* بحث */}
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد مستخدمين</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div
              key={u.uid}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">

                  {/* Name + Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm">{u.displayName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status]}`}>
                      {STATUS_LABELS[u.status]}
                    </span>
                    {/* لو super_admin يشوف اسم الشركة على كل user */}
                    {currentUser?.role === 'super_admin' && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Building2 size={11} />
                        {companies.find((c) => c.id === u.companyId)?.name ?? u.companyId}
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>

                  {/* Role badge */}
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg mt-1.5 inline-block">
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(u)}
                    className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="تعديل"
                  >
                    <Pencil size={14} />
                  </button>
                  {/* لا يقدر يحذف نفسه */}
                  {u.uid !== currentUser?.uid && (
                    <button
                      onClick={() => openDelete(u)}
                      className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Add / Edit Modal ══════════════════════════════════════════════════ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editUid ? 'تعديل مستخدم' : 'إضافة مستخدم'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button loading={submitting} onClick={handleSubmit}>
              {editUid ? 'حفظ التعديلات' : 'إضافة'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* الاسم */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              الاسم الكامل <span className="text-red-500">*</span>
            </label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="محمد أحمد"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* حقول الإنشاء فقط */}
          {!editUid && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  كلمة المرور <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="6 أحرف على الأقل"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* الشركة — super_admin فقط يقدر يغيرها */}
              {currentUser?.role === 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    الشركة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.companyId}
                    onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— اختر الشركة —</option>
                    {availableCompanies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* الدور — مقيد بـ creatableRoles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الدور</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {/* لو التعديل وكان دور المستخدم خارج creatableRoles نوضح ذلك */}
            {editUid && !creatableRoles.includes(form.role) && (
              <p className="text-xs text-amber-600 mt-1">
                لا يمكنك تغيير دور هذا المستخدم
              </p>
            )}
          </div>

          {/* الحالة — في وضع التعديل فقط */}
          {editUid && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as User['status'] }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">نشط</option>
                <option value="pending">معلق</option>
                <option value="suspended">موقوف</option>
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* ══ Delete Confirm Modal ══════════════════════════════════════════════ */}
      <Modal
        open={!!deleteUid}
        onClose={() => { setDeleteUid(null); setDeleteUser(null); }}
        title="حذف مستخدم"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleteUid(null); setDeleteUser(null); }}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              حذف
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          هل أنت متأكد من حذف المستخدم{' '}
          <span className="font-bold text-gray-900">{deleteUser?.displayName}</span>؟
          <br />
          <span className="text-red-500 text-xs mt-1 block">لا يمكن التراجع عن هذا الإجراء.</span>
        </p>
      </Modal>
    </div>
  );
}
