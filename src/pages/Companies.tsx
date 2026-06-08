import { useState } from 'react';
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react';
import { useCompanies } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { Company } from '../types';

const EMPTY_FORM = { name: '', status: 'active' as Company['status'] };

export default function Companies() {
  const { user } = useAuth();
  const { companies, loading, create, update, remove } = useCompanies();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (user?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <p className="text-sm">متاح لمدير النظام فقط</p>
      </div>
    );
  }

  const filtered = companies.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  }

  function openEdit(c: Company) {
    setEditId(c.id);
    setForm({ name: c.name, status: c.status });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('اسم الشركة مطلوب'); return; }
    setSubmitting(true); setError('');
    try {
      if (editId) await update(editId, form);
      else await create(form);
      setShowModal(false);
    } catch {
      setError('حدث خطأ');
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">الشركات ({companies.length})</h1>
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>إضافة</Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم الشركة..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
          <p className="text-2xl font-bold text-emerald-700">{companies.filter((c) => c.status === 'active').length}</p>
          <p className="text-xs text-gray-500">نشطة</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
          <p className="text-2xl font-bold text-red-700">{companies.filter((c) => c.status === 'suspended').length}</p>
          <p className="text-xs text-gray-500">موقوفة</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد شركات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Building2 size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status === 'active' ? 'نشطة' : 'موقوفة'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'تعديل شركة' : 'إضافة شركة'}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Company['status'] }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">نشطة</option>
              <option value="suspended">موقوفة</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="حذف شركة"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleDelete}>حذف</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">هل أنت متأكد؟ حذف الشركة لا يحذف بياناتها.</p>
      </Modal>
    </div>
  );
}
