import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Phone, FileText, Download } from 'lucide-react';
import { useClients, useAgents } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { MONTH_LIST, YEAR_LIST, PAYMENT_METHODS } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { exportToExcel, clientsToExportData } from '../utils/exportUtils';
import type { Client, ProductionType, PaymentMethod } from '../types';

const STATUS_COLORS: Record<Client['status'], string> = {
  'نشط':   'bg-emerald-100 text-emerald-700',
  'متأخر': 'bg-amber-100 text-amber-700',
  'ملغي':  'bg-red-100 text-red-700',
};

function emptyForm(agentName = '', group = '', productionType: ProductionType = 'agent') {
  return {
    agentName, group, productionType,
    clientName: '', startMonth: 'يناير', startYear: new Date().getFullYear(),
    annualTarget: 0, paymentMethod: 'شهري' as PaymentMethod, paymentAmount: 0,
    lastCollectionMonth: '', phone: '', policyNumber: '',
    insuranceCompany: '', insuranceType: '', notes: '',
    status: 'نشط' as Client['status'],
  };
}

export default function Clients() {
  const { user } = useAuth();
  const { clients, loading, create, update, remove } = useClients();
  const { agents } = useAgents();

  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const groups = [...new Set(agents.map((a) => a.group))].filter(Boolean);

  // الوكلاء المتاحين للاختيار — حسب الدور
  const availableAgents = useMemo(() => {
    if (user?.role === 'agent') return [];  // الوكيل مش محتاج يختار
    return agents.filter((a) => a.status === 'active');
  }, [agents, user?.role]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        c.clientName.toLowerCase().includes(q) ||
        c.agentName.toLowerCase().includes(q) ||
        (c.policyNumber ?? '').includes(q);
      const matchGroup = !filterGroup || c.group === filterGroup;
      const matchStatus = !filterStatus || c.status === filterStatus;
      return matchSearch && matchGroup && matchStatus;
    });
  }, [clients, search, filterGroup, filterStatus]);

  function openAdd() {
    setEditId(null);
    // لو الدور وكيل — حط اسمه تلقائياً
    if (user?.role === 'agent') {
      const myAgent = agents.find((a) => a.name === user.displayName);
      setForm(emptyForm(user.displayName, myAgent?.group ?? '', myAgent?.productionType ?? 'agent'));
    } else {
      setForm(emptyForm());
    }
    setError('');
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditId(c.id);
    setForm({
      agentName: c.agentName, group: c.group, productionType: c.productionType,
      clientName: c.clientName, startMonth: c.startMonth, startYear: c.startYear,
      annualTarget: c.annualTarget, paymentMethod: c.paymentMethod, paymentAmount: c.paymentAmount,
      lastCollectionMonth: c.lastCollectionMonth, phone: c.phone ?? '',
      policyNumber: c.policyNumber ?? '', insuranceCompany: c.insuranceCompany ?? '',
      insuranceType: c.insuranceType ?? '', notes: c.notes ?? '', status: c.status,
    });
    setError('');
    setShowModal(true);
  }

  function handleAgentChange(name: string) {
    const agent = agents.find((a) => a.name === name);
    setForm((f) => ({
      ...f,
      agentName: name,
      group: agent?.group ?? f.group,
      productionType: agent?.productionType ?? f.productionType,
    }));
  }

  async function handleSubmit() {
    if (!form.clientName.trim()) { setError('اسم العميل مطلوب'); return; }
    if (!form.agentName.trim()) { setError('اسم الوكيل مطلوب'); return; }
    setSubmitting(true); setError('');
    try {
      const companyId = user?.companyId ?? '';
      if (editId) {
        await update(editId, { ...form, companyId });
      } else {
        await create({ ...form, companyId });
      }
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

  const canDelete = ['sales_manager', 'super_admin', 'general_supervisor', 'supervisor'].includes(user?.role ?? '');
  const isAgent = user?.role === 'agent';

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900">العملاء ({filtered.length})</h1>
        <div className="flex gap-2">
          <Button size="sm" icon={<Download size={14} />} variant="secondary"
            onClick={() => exportToExcel(clientsToExportData(filtered), 'عملاء', 'clients')}>
            تصدير
          </Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>إضافة</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الوثيقة..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {!isAgent && (
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">كل المجموعات</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">كل الحالات</option>
          <option value="نشط">نشط</option>
          <option value="متأخر">متأخر</option>
          <option value="ملغي">ملغي</option>
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['نشط', 'متأخر', 'ملغي'] as const).map((s) => (
          <div key={s} className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <p className={`text-lg font-bold ${STATUS_COLORS[s].split(' ')[1]}`}>
              {clients.filter((c) => c.status === s).length}
            </p>
            <p className="text-xs text-gray-500">{s}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm">{c.clientName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.agentName} · {c.group}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">{c.paymentMethod}</span>
                    <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-lg">{formatCurrency(c.annualTarget)}/سنة</span>
                    {c.insuranceType && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg">{c.insuranceType}</span>}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Phone size={10} />{c.phone}
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    البداية: {c.startMonth} {c.startYear} · آخر تحصيل: {c.lastCollectionMonth}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                    <Pencil size={14} />
                  </button>
                  {canDelete && (
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
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
        title={editId ? 'تعديل عميل' : 'إضافة عميل جديد'} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button loading={submitting} onClick={handleSubmit}>
              {editId ? 'حفظ التعديلات' : 'إضافة العميل'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">

            {/* اسم العميل */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم العميل *</label>
              <input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* الوكيل — تلقائي للوكيل، dropdown للباقي */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الوكيل *</label>
              {isAgent ? (
                <input value={form.agentName} disabled
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-500" />
              ) : (
                <select value={form.agentName} onChange={(e) => handleAgentChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— اختر الوكيل —</option>
                  {availableAgents.map((a) => (
                    <option key={a.name} value={a.name}>{a.name} ({a.group})</option>
                  ))}
                </select>
              )}
            </div>

            {/* شهر البداية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">شهر البداية</label>
              <select value={form.startMonth} onChange={(e) => setForm((f) => ({ ...f, startMonth: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONTH_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* سنة البداية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">سنة البداية</label>
              <select value={form.startYear} onChange={(e) => setForm((f) => ({ ...f, startYear: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {YEAR_LIST.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* التارجت */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">التارجت السنوي (ج.م)</label>
              <input type="number" value={form.annualTarget}
                onChange={(e) => setForm((f) => ({ ...f, annualTarget: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* طريقة السداد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة السداد</label>
              <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* نوع الوثيقة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الوثيقة</label>
              <input value={form.insuranceType} onChange={(e) => setForm((f) => ({ ...f, insuranceType: e.target.value }))}
                placeholder="مثال: الرباعية، حماية واستثمار..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* رقم الوثيقة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الوثيقة</label>
              <input value={form.policyNumber} onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* شركة التأمين */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">شركة التأمين</label>
              <input value={form.insuranceCompany} onChange={(e) => setForm((f) => ({ ...f, insuranceCompany: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* رقم الهاتف */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الهاتف</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* الحالة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Client['status'] }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="نشط">نشط</option>
                <option value="متأخر">متأخر</option>
                <option value="ملغي">ملغي</option>
              </select>
            </div>

            {/* ملاحظات */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="حذف عميل"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleDelete}>حذف</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع.</p>
      </Modal>
    </div>
  );
}
