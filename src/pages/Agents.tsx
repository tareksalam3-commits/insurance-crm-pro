import { useState } from 'react';
import { Plus, Pencil, Trash2, UserCheck, Search } from 'lucide-react';
import { useAgents } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { Agent, ProductionType } from '../types';

const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  agent: 'وكيل',
  group_leader: 'رئيس مجموعة',
  supervisor: 'مراقب',
  general_supervisor: 'مراقب عام',
  sales_manager: 'مدير مبيعات',
};

const STATUS_COLORS = {
  active:    'bg-emerald-100 text-emerald-700',
  inactive:  'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = { active: 'نشط', inactive: 'غير نشط', suspended: 'موقوف' };

const EMPTY_FORM = {
  name: '', group: '', productionType: 'agent' as ProductionType,
  target: 0, status: 'active' as Agent['status'],
};

export default function Agents() {
  const { user } = useAuth();
  const { agents, loading, create, update, remove } = useAgents();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canManage = ['sales_manager', 'super_admin', 'general_supervisor'].includes(user?.role ?? '');

  const filtered = agents.filter((a) => {
    if (!search) return true;
    return a.name.toLowerCase().includes(search.toLowerCase()) || a.group.toLowerCase().includes(search.toLowerCase());
  });

  const groups = [...new Set(agents.map((a) => a.group))].filter(Boolean);

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  }

  function openEdit(a: Agent) {
    setEditId(a.id);
    setForm({ name: a.name, group: a.group, productionType: a.productionType, target: a.target, status: a.status });
    setError('');
    setShowModal(true);
  }

  // When productionType is not agent, target must be 0
  function handleProductionTypeChange(pt: ProductionType) {
    setForm((f) => ({ ...f, productionType: pt, target: pt === 'agent' ? f.target : 0 }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('اسم الوكيل مطلوب'); return; }
    if (!form.group.trim()) { setError('المجموعة مطلوبة'); return; }
    setSubmitting(true); setError('');
    try {
      const companyId = user?.companyId ?? '';
      const payload = { ...form, companyId, target: form.productionType === 'agent' ? form.target : 0 };
      if (editId) await update(editId, payload);
      else await create(payload);
      setShowModal(false);
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">الوكلاء ({filtered.length})</h1>
        {canManage && (
          <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>إضافة</Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو المجموعة..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(['active', 'inactive', 'suspended'] as const).map((s) => (
          <div key={s} className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <p className={`text-lg font-bold ${STATUS_COLORS[s].split(' ')[1]}`}>
              {agents.filter((a) => a.status === s).length}
            </p>
            <p className="text-xs text-gray-500">{STATUS_LABELS[s]}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد وكلاء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm">{a.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{a.group}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">
                      {PRODUCTION_TYPE_LABELS[a.productionType]}
                    </span>
                    {a.productionType === 'agent' && a.target > 0 && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg">
                        تارجت: {a.target.toLocaleString('ar-EG')}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(a)}
                      className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(a.id)}
                      className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'تعديل وكيل' : 'إضافة وكيل جديد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button loading={submitting} onClick={handleSubmit}>{editId ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المجموعة *</label>
            <input value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
              list="groups-list"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <datalist id="groups-list">
              {groups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإنتاج</label>
            <select value={form.productionType} onChange={(e) => handleProductionTypeChange(e.target.value as ProductionType)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(PRODUCTION_TYPE_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          {form.productionType === 'agent' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">التارجت السنوي (ج.م)</label>
              <input type="number" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Agent['status'] }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="suspended">موقوف</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="حذف وكيل"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleDelete}>حذف</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا الوكيل؟</p>
      </Modal>
    </div>
  );
}
