import { useState, useMemo } from 'react';
import { Pencil, Trash2, Users, UserCheck, Shield, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useAgents } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { Agent, ProductionType } from '../types';

const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  agent:              'وكيل',
  group_leader:       'رئيس مجموعة',
  supervisor:         'مراقب',
  general_supervisor: 'مراقب عام',
  sales_manager:      'مدير مبيعات',
};

const STATUS_COLORS = {
  active:    'bg-emerald-100 text-emerald-700',
  inactive:  'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
};
const STATUS_LABELS = { active: 'نشط', inactive: 'غير نشط', suspended: 'موقوف' };

// ─── بطاقة وكيل مصغرة ────────────────────────────────────────────────────────

function AgentCard({
  agent,
  canManage,
  onEdit,
  onDelete,
}: {
  agent: Agent;
  canManage: boolean;
  onEdit: (a: Agent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{agent.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[agent.status]}`}>
              {STATUS_LABELS[agent.status]}
            </span>
          </div>
          {agent.email && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{agent.email}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">
              {PRODUCTION_TYPE_LABELS[agent.productionType]}
            </span>
            {agent.target > 0 && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg">
                تارجت: {agent.target.toLocaleString('ar-EG')}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(agent.id)}
              className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── قسم قابل للطي ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  count,
  colorClass,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3.5 ${colorClass} transition-colors`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-sm">{title}</span>
          <span className="text-xs opacity-70 font-medium">({count})</span>
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div className="bg-gray-50 p-3 space-y-2">
          {count === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">لا يوجد</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Agents() {
  const { user } = useAuth();
  const { agents, loading, update, remove } = useAgents();

  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState({ name: '', group: '', target: 0, status: 'active' as Agent['status'] });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  const canManage = ['sales_manager', 'super_admin', 'general_supervisor'].includes(user?.role ?? '');

  // فلترة بالبحث
  const filtered = useMemo(() =>
    agents.filter((a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.group.toLowerCase().includes(search.toLowerCase())
    ),
    [agents, search]
  );

  // تقسيم حسب النوع
  const supervisors  = useMemo(() => filtered.filter((a) => a.productionType === 'supervisor' || a.productionType === 'general_supervisor'), [filtered]);
  const groupLeaders = useMemo(() => filtered.filter((a) => a.productionType === 'group_leader'), [filtered]);
  const agentsList   = useMemo(() => filtered.filter((a) => a.productionType === 'agent'), [filtered]);

  // تجميع الوكلاء حسب المجموعة (رئيس المجموعة)
  const agentsByGroup = useMemo(() => {
    const map = new Map<string, Agent[]>();
    agentsList.forEach((a) => {
      const key = a.group || 'بدون مجموعة';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [agentsList]);

  function openEdit(a: Agent) {
    setEditId(a.id);
    setForm({ name: a.name, group: a.group, target: a.target, status: a.status });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit() {
    setSubmitting(true); setError('');
    try {
      if (editId) await update(editId, { target: form.target, status: form.status, group: form.group });
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          الفريق ({filtered.length})
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
          <p className="text-lg font-bold text-orange-600">{supervisors.length}</p>
          <p className="text-xs text-gray-500">مراقبون</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
          <p className="text-lg font-bold text-purple-600">{groupLeaders.length}</p>
          <p className="text-xs text-gray-500">رؤساء مجموعات</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
          <p className="text-lg font-bold text-blue-600">{agentsList.length}</p>
          <p className="text-xs text-gray-500">وكلاء</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو المجموعة..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد أعضاء في الفريق</p>
          <p className="text-xs mt-1">يظهرون هنا بعد الموافقة على طلبات الانضمام</p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── قسم المراقبين ── */}
          {supervisors.length > 0 && (
            <Section
              title="المراقبون"
              icon={<Shield size={16} className="text-orange-600" />}
              count={supervisors.length}
              colorClass="bg-orange-50 text-orange-800 hover:bg-orange-100"
            >
              {supervisors.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  canManage={canManage}
                  onEdit={openEdit}
                  onDelete={setDeleteId}
                />
              ))}
            </Section>
          )}

          {/* ── قسم رؤساء المجموعات ── */}
          {groupLeaders.length > 0 && (
            <Section
              title="رؤساء المجموعات"
              icon={<Users size={16} className="text-purple-600" />}
              count={groupLeaders.length}
              colorClass="bg-purple-50 text-purple-800 hover:bg-purple-100"
            >
              {groupLeaders.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  canManage={canManage}
                  onEdit={openEdit}
                  onDelete={setDeleteId}
                />
              ))}
            </Section>
          )}

          {/* ── قسم الوكلاء مقسمين بالمجموعات ── */}
          {agentsList.length > 0 && (
            <Section
              title="الوكلاء"
              icon={<UserCheck size={16} className="text-blue-600" />}
              count={agentsList.length}
              colorClass="bg-blue-50 text-blue-800 hover:bg-blue-100"
            >
              {Array.from(agentsByGroup.entries()).map(([group, members]) => (
                <div key={group} className="space-y-2">
                  {/* رأس المجموعة */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                      {group} ({members.length})
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  {members.map((a) => (
                    <AgentCard
                      key={a.id}
                      agent={a}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={setDeleteId}
                    />
                  ))}
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="تعديل بيانات العضو"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button loading={submitting} onClick={handleSubmit}>حفظ</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم</label>
            <input value={form.name} disabled
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المجموعة / المدير المباشر</label>
            <input
              value={form.group}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">التارجت السنوي (ج.م)</label>
            <input
              type="number"
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Agent['status'] }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="suspended">موقوف</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="حذف عضو"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleDelete}>حذف</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا العضو؟</p>
      </Modal>
    </div>
  );
}
