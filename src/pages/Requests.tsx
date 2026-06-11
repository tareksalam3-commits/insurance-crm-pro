import { useState } from 'react';
import {
  ClipboardList, CheckCircle, XCircle, Loader2,
  UserCheck, Phone, Mail, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useRegistrationRequests } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  getUsersByRole,
} from '../services/authService';
import { ROLE_LABELS } from '../types';
import type { RegistrationRequest, User } from '../types';

// ─── بطاقة الطلب ──────────────────────────────────────────────────────────────

function RequestCard({
  req,
  isProcessing,
  onApprove,
  onReject,
  canAssign,  // المراقب العام يعيّن المراقب ورئيس المجموعة
}: {
  req: RegistrationRequest;
  isProcessing: boolean;
  onApprove: (req: RegistrationRequest, assign: AssignData) => Promise<void>;
  onReject: (req: RegistrationRequest) => Promise<void>;
  canAssign: boolean;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [supervisors,    setSupervisors]    = useState<User[]>([]);
  const [groupLeaders,   setGroupLeaders]   = useState<User[]>([]);
  const [selectedSup,    setSelectedSup]    = useState('');
  const [selectedLeader, setSelectedLeader] = useState('');
  const [loadingPeople,  setLoadingPeople]  = useState(false);

  async function handleExpand() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (!canAssign || supervisors.length > 0) return;
    setLoadingPeople(true);
    try {
      const [sups, leaders] = await Promise.all([
        getUsersByRole(req.companyId, 'supervisor'),
        getUsersByRole(req.companyId, 'group_leader'),
      ]);
      setSupervisors(sups);
      setGroupLeaders(leaders);
    } finally {
      setLoadingPeople(false);
    }
  }

  async function handleApprove() {
    const sup    = supervisors.find((s) => s.uid === selectedSup);
    const leader = groupLeaders.find((l) => l.uid === selectedLeader);
    await onApprove(req, {
      supervisorId:    sup?.uid    ?? '',
      supervisorName:  sup?.displayName ?? '',
      groupLeaderId:   leader?.uid    ?? '',
      groupLeaderName: leader?.displayName ?? '',
    });
  }

  const roleColor: Record<string, string> = {
    agent:              'bg-blue-50 text-blue-700',
    group_leader:       'bg-purple-50 text-purple-700',
    supervisor:         'bg-orange-50 text-orange-700',
    general_supervisor: 'bg-red-50 text-red-700',
    sales_manager:      'bg-gray-100 text-gray-700',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
      {/* الرأس دائماً ظاهر */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">{req.displayName}</p>

            <div className="flex flex-col gap-1 mt-1.5">
              {req.email && (
                <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                  <Mail size={11} /> {req.email}
                </p>
              )}
              {req.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone size={11} /> {req.phone}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${roleColor[req.requestedRole] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABELS[req.requestedRole]}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Building2 size={10} /> {req.companyName}
              </span>
            </div>
          </div>

          {/* زر توسيع */}
          <button
            onClick={handleExpand}
            className="flex-shrink-0 p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* التفاصيل وأزرار التعيين — تظهر عند التوسيع */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">

          {canAssign && (
            <>
              {loadingPeople ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> جاري تحميل الفريق...
                </div>
              ) : (
                <>
                  {/* اختيار المراقب */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      تعيين المراقب
                      <span className="font-normal text-gray-400 mr-1">(اختياري — يُعيَّن لاحقاً)</span>
                    </label>
                    {supervisors.length === 0 ? (
                      <p className="text-xs text-amber-600 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                        لا يوجد مراقبون في الشركة حالياً
                      </p>
                    ) : (
                      <select
                        value={selectedSup}
                        onChange={(e) => setSelectedSup(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— بدون تعيين الآن —</option>
                        {supervisors.map((s) => (
                          <option key={s.uid} value={s.uid}>{s.displayName}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* اختيار رئيس المجموعة */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      تعيين رئيس المجموعة
                      <span className="font-normal text-gray-400 mr-1">(اختياري — يُعيَّن لاحقاً)</span>
                    </label>
                    {groupLeaders.length === 0 ? (
                      <p className="text-xs text-amber-600 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                        لا يوجد رؤساء مجموعات في الشركة حالياً
                      </p>
                    ) : (
                      <select
                        value={selectedLeader}
                        onChange={(e) => setSelectedLeader(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— بدون تعيين الآن —</option>
                        {groupLeaders.map((l) => (
                          <option key={l.uid} value={l.uid}>{l.displayName}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* أزرار الموافقة والرفض */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApprove}
              disabled={isProcessing || loadingPeople}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isProcessing
                ? <Loader2 size={14} className="animate-spin" />
                : <CheckCircle size={14} />
              }
              موافقة
            </button>
            <button
              onClick={() => onReject(req)}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle size={14} />
              رفض
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignData {
  supervisorId:    string;
  supervisorName:  string;
  groupLeaderId:   string;
  groupLeaderName: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Requests() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const { requests, loading } = useRegistrationRequests();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!permissions.canApproveRequests) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <p className="text-sm">غير مصرح لك</p>
      </div>
    );
  }

  // المراقب العام هو المسؤول عن تعيين المراقب ورئيس المجموعة
  const canAssign = user?.role === 'general_supervisor' ||
                    user?.role === 'sales_manager'      ||
                    user?.role === 'super_admin';

  const scopeNote =
    user?.role === 'general_supervisor'
      ? 'تعرض جميع طلبات الانضمام المعلقة في شركتك. أنت المسؤول عن تعيين المراقب ورئيس المجموعة.'
      : user?.role === 'supervisor'
      ? 'تعرض الطلبات الموجهة إليك فقط.'
      : user?.role === 'sales_manager'
      ? 'تعرض جميع طلبات الانضمام في شركتك.'
      : null;

  async function handleApprove(req: RegistrationRequest, assign: AssignData) {
    setProcessingId(req.id);
    try {
      await approveRegistrationRequest(req, assign);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الموافقة. تأكد من الاتصال بالإنترنت وحاول مجدداً.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(req: RegistrationRequest) {
    if (!confirm(`هل تريد رفض طلب "${req.displayName}"؟`)) return;
    setProcessingId(req.id);
    try {
      await rejectRegistrationRequest(req.id);
    } catch {
      alert('حدث خطأ أثناء الرفض. حاول مجدداً.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-blue-600" />
        <h1 className="text-lg font-bold text-gray-900">طلبات الانضمام</h1>
        {requests.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {requests.length}
          </span>
        )}
      </div>

      {scopeNote && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          {scopeNote}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد طلبات معلقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              isProcessing={processingId === req.id}
              onApprove={handleApprove}
              onReject={handleReject}
              canAssign={canAssign}
            />
          ))}
        </div>
      )}
    </div>
  );
}
