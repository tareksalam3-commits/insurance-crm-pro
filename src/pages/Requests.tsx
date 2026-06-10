import { useState } from 'react';
import { ClipboardList, CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import { useRegistrationRequests } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  updateUserProfile,
  getPotentialManagers,
} from '../services/authService';
import { ROLE_LABELS } from '../types';
import type { RegistrationRequest, User } from '../types';

export default function Requests() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const { requests, loading } = useRegistrationRequests();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // حالة تعيين رئيس المجموعة بعد الموافقة (للـ agent فقط)
  const [assignModal, setAssignModal] = useState<{
    uid: string;
    displayName: string;
    companyId: string;
  } | null>(null);
  const [groupLeaders, setGroupLeaders] = useState<User[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [leadersLoading, setLeadersLoading] = useState(false);

  if (!permissions.canApproveRequests) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <p className="text-sm">غير مصرح لك</p>
      </div>
    );
  }

  async function handleApprove(req: RegistrationRequest) {
    setProcessingId(req.id);
    try {
      await approveRegistrationRequest(req);
      alert('تمت الموافقة على الطلب بنجاح! تم إنشاء الحساب وإضافة المستخدم إلى الوكلاء.');
    } catch (e) {
      // معالجة الخطأ بدون طباعة على console
      const errorMessage = e instanceof Error ? e.message : 'خطأ غير معروف';
      alert(`حدث خطأ أثناء الموافقة: ${errorMessage}. تأكد من الاتصال بالإنترنت وحاول مجدداً.`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(req: RegistrationRequest) {
    if (!confirm('هل تريد رفض هذا الطلب؟')) return;
    setProcessingId(req.id);
    try {
      await rejectRegistrationRequest(req.id);
    } catch {
      alert('حدث خطأ أثناء الرفض. حاول مجدداً.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAssignLeader() {
    if (!assignModal) return;
    setAssignLoading(true);
    try {
      if (selectedLeaderId) {
        await updateUserProfile(assignModal.uid, { managerId: selectedLeaderId });
      }
      setAssignModal(null);
    } catch {
      alert('حدث خطأ أثناء تعيين رئيس المجموعة');
    } finally {
      setAssignLoading(false);
    }
  }

  // توضيح نطاق الطلبات حسب الدور
  const scopeNote =
    user?.role === 'general_supervisor'
      ? 'تعرض طلبات المراقبين الموجهة إليك فقط.'
      : user?.role === 'supervisor'
      ? 'تعرض طلبات الوكلاء ورؤساء المجموعات الموجهة إليك فقط.'
      : user?.role === 'sales_manager'
      ? 'تعرض جميع طلبات الانضمام في شركتك.'
      : null;

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

      {/* توضيح النطاق */}
      {scopeNote && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          {scopeNote}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد طلبات معلقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isProcessing = processingId === req.id;
            return (
              <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{req.displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{req.email}</p>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">
                        {ROLE_LABELS[req.requestedRole]}
                      </span>
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg">
                        {req.companyName}
                      </span>
                    </div>

                    {req.managerName && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        المرجع: {req.managerName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      موافقة
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      رفض
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}
