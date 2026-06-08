import { useState } from 'react';
import { Plus, Pencil, Trash2, Shield, Search } from 'lucide-react';
import { useUsers, useCompanies } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { USER_ROLES, ROLE_LABELS } from '../types';
import type { User, UserRole } from '../types';

const STATUS_COLORS = {
  active:    'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = { active: 'نشط', pending: 'معلق', suspended: 'موقوف' };

const EMPTY_FORM = {
  email: '', password: '', displayName: '',
  role: 'agent' as UserRole, companyId: '', status: 'active' as User['status'],
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const { companies } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState(
    currentUser?.role === 'super_admin' ? '' : currentUser?.companyId ?? ''
  );
  const { users, loading, create, update, remove } = useUsers(selectedCompany || undefined);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteUid, setDeleteUid] = useState<string | null>(null);

  const canManage = ['super_admin', 'sales_manager'].includes(currentUser?.role ?? '');

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  function openAdd() {
    setEditUid(null);
    setForm({ ...EMPTY_FORM, companyId: selectedCompany || currentUser?.companyId || '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUid(u.uid);
    setForm({ email: u.email, password: '', displayName: u.displayName, role: u.role, companyId: u.companyId, status: u.status });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.displayName.trim()) { setError('الاسم مطلوب'); return; }
    if (!editUid && !form.email.trim()) { setError('البريد الإلكتروني مطلوب'); return; }
    if (!editUid && form.password.length < 6) { setError('كلمة المرور 6 أحرف على الأقل'); return; }
    setSubmitting(true); setError('');
    try {
      if (editUid) {
        await update(editUid, { displayName: form.displayName, role: form.role, status: form.status });
      } else {
        await create({ email: form.email, password: form.password, displayName: form.displayName, role: form.role, companyId: form.companyId });
      }
      setShowModal(false);
    } catch (e: any) {
      setError(e?.message ?? 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteUid) return;
    await remove(deleteUid);
    setDeleteUid(null);
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <p className="text-sm">غير مصرح لك بعرض هذه الصفحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">المستخدمين ({filtered.length})</h1>
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>إضافة</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {currentUser?.role === 'super_admin' && (
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">كل الشركات</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد مستخدمين</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.uid} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm">{u.displayName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status]}`}>
                      {STATUS_LABELS[u.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg mt-1.5 inline-block">
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                    <Pencil size={14} />
                  </button>
                  {u.uid !== currentUser?.uid && (
                    <button onClick={() => setDeleteUid(u.uid)} className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editUid ? 'تعديل مستخدم' : 'إضافة مستخدم'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button loading={submitting} onClick={handleSubmit}>{editUid ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل *</label>
            <input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {!editUid && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني *</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور *</label>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {currentUser?.role === 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الشركة</label>
                  <select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— اختر الشركة —</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الدور</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as User['status'] }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">نشط</option>
              <option value="pending">معلق</option>
              <option value="suspended">موقوف</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteUid} onClose={() => setDeleteUid(null)} title="حذف مستخدم"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteUid(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleDelete}>حذف</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا المستخدم؟</p>
      </Modal>
    </div>
  );
}
