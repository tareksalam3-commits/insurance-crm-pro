import { useState, useMemo, useEffect, useCallback } from 'react';
import { Bell, CheckCircle2, MessageCircle, Search, Wallet, AlertTriangle, Loader2 } from 'lucide-react';
import { useClients } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatUtils';
import { MONTH_LIST, YEAR_LIST } from '../types';
import type { Client, PaymentRecord } from '../types';
import {
  subscribeToPaymentRecords,
  addPaymentRecord,
  deletePaymentRecord,
  notifyManagerOfCollection,
} from '../services/paymentRecordsService';
import { isCollectionMonth, isNewProductionMonth, calculatePaymentAmount } from '../services/paymentService';

const NOW = new Date();

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  client,
  amount,
  isNew,
  onConfirm,
  onCancel,
  loading,
}: {
  client: Client;
  amount: number;
  isNew: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNew ? 'bg-blue-100' : 'bg-emerald-100'}`}>
            <CheckCircle2 size={20} className={isNew ? 'text-blue-600' : 'text-emerald-600'} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">تأكيد التحصيل</p>
            <p className="text-xs text-gray-500">{isNew ? 'إنتاج جديد' : 'دفعة تحصيل'}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 space-y-1">
          <p className="text-sm font-semibold text-gray-900">{client.clientName}</p>
          <p className="text-xs text-gray-500">{client.agentName} · {client.paymentMethod}</p>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(amount)}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 transition-all ${
      type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {message}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Collections() {
  const { user } = useAuth();
  const { clients } = useClients();
  const [selectedMonth, setSelectedMonth] = useState(MONTH_LIST[NOW.getMonth()]);
  const [selectedYear, setSelectedYear]   = useState(NOW.getFullYear());
  const [search, setSearch]               = useState('');
  const [records, setRecords]             = useState<PaymentRecord[]>([]);

  // Confirm dialog state
  const [confirmClient, setConfirmClient] = useState<Client | null>(null);
  const [collecting, setCollecting]       = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!user?.companyId) return;
    const unsub = subscribeToPaymentRecords(
      (data) => setRecords(data),
      user.companyId,
      { month: selectedMonth, year: selectedYear }
    );
    return unsub;
  }, [user?.companyId, selectedMonth, selectedYear]);

  // ✅ FIX + UX: تلوين العملاء المتأخرين — status === 'متأخر' يظهر باللون الأحمر
  const dueClients = useMemo(() => {
    return clients
      .filter((c) => {
        if (c.status === 'ملغي') return false;
        const isDue =
          isCollectionMonth(c, selectedMonth, selectedYear) ||
          isNewProductionMonth(c, selectedMonth, selectedYear);
        if (!isDue) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.clientName.toLowerCase().includes(q) ||
          c.agentName.toLowerCase().includes(q)
        );
      })
      // ✅ المتأخرون أول — مرتّبين بالحالة ثم بالاسم
      .sort((a, b) => {
        if (a.status === 'متأخر' && b.status !== 'متأخر') return -1;
        if (b.status === 'متأخر' && a.status !== 'متأخر') return 1;
        return a.clientName.localeCompare(b.clientName, 'ar');
      });
  }, [clients, selectedMonth, selectedYear, search]);

  const collectedIds    = new Set(records.map((r) => r.clientId));
  const collectedCount  = dueClients.filter((c) => collectedIds.has(c.id)).length;
  const pendingCount    = dueClients.length - collectedCount;
  const totalAmount     = dueClients.reduce((s, c) => s + calculatePaymentAmount(c.annualTarget, c.paymentMethod), 0);
  const collectedAmount = dueClients
    .filter((c) => collectedIds.has(c.id))
    .reduce((s, c) => s + calculatePaymentAmount(c.annualTarget, c.paymentMethod), 0);

  // ✅ FIX: Confirmation dialog قبل التحصيل
  function openConfirm(client: Client) {
    if (collectedIds.has(client.id)) return; // مسبقاً محصّل
    setConfirmClient(client);
  }

  async function handleConfirmCollect() {
    if (!confirmClient || !user?.companyId) return;
    setCollecting(true);
    try {
      const amount = calculatePaymentAmount(confirmClient.annualTarget, confirmClient.paymentMethod);
      await addPaymentRecord({
        companyId:   user.companyId,
        clientId:    confirmClient.id,
        clientName:  confirmClient.clientName,
        agentName:   confirmClient.agentName,
        group:       confirmClient.group,
        amount,
        month:       selectedMonth,
        year:        selectedYear,
        collectedBy: user.displayName,
      });

      // ✅ إشعار المدير المباشر عند التحصيل
      if (user.managerId) {
        await notifyManagerOfCollection({
          recipientId: user.managerId,
          companyId:   user.companyId,
          clientId:    confirmClient.id,
          clientName:  confirmClient.clientName,
          agentName:   confirmClient.agentName,
          amount,
          month:       selectedMonth,
          year:        selectedYear,
          collectedBy: user.displayName,
        }).catch(() => { /* إشعار اختياري — لا يوقف العملية */ });
      }

      showToast('تم التحصيل بنجاح ✓');
      setConfirmClient(null);
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_PAYMENT') {
        showToast('هذا العميل تم تحصيله بالفعل', 'error');
      } else {
        showToast('حدث خطأ، حاول مرة أخرى', 'error');
      }
    } finally {
      setCollecting(false);
    }
  }

  async function handleUndo(clientId: string) {
    const record = records.find((r) => r.clientId === clientId);
    if (!record) return;
    try {
      await deletePaymentRecord(record.id);
      showToast('تم إلغاء التحصيل');
    } catch {
      showToast('حدث خطأ أثناء الإلغاء', 'error');
    }
  }

  function handleWhatsApp(client: Client) {
    if (!client.phone) return;
    const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
    const msg = encodeURIComponent(
      `السلام عليكم ${client.clientName}،\nيرجى العلم باستحقاق دفعة بمبلغ ${formatCurrency(amount)} لشهر ${selectedMonth} ${selectedYear}.\nشكراً`
    );
    window.open(`https://wa.me/2${client.phone.replace(/^0/, '')}?text=${msg}`, '_blank');
  }

  // ── color helper للبطاقة ──────────────────────────────────────
  function cardClasses(client: Client, isCollected: boolean, isNew: boolean) {
    if (isCollected) return 'bg-emerald-50 border-emerald-200';
    if (client.status === 'متأخر') return 'bg-red-50 border-red-300 shadow-red-100';
    if (isNew) return 'bg-blue-50 border-blue-200';
    return 'bg-white border-gray-100';
  }

  function dotClasses(client: Client, isCollected: boolean, isNew: boolean) {
    if (isCollected) return 'bg-emerald-500';
    if (client.status === 'متأخر') return 'bg-red-500 animate-pulse';
    if (isNew) return 'bg-blue-500';
    return 'bg-amber-400';
  }

  return (
    <div className="space-y-4">

      {/* Confirm dialog */}
      {confirmClient && (
        <ConfirmDialog
          client={confirmClient}
          amount={calculatePaymentAmount(confirmClient.annualTarget, confirmClient.paymentMethod)}
          isNew={isNewProductionMonth(confirmClient, selectedMonth, selectedYear)}
          onConfirm={handleConfirmCollect}
          onCancel={() => setConfirmClient(null)}
          loading={collecting}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Wallet size={20} className="text-blue-600" />التحصيل
        </h1>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {YEAR_LIST.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">إجمالي الدفعات</p>
          <p className="text-xl font-bold text-gray-900">{dueClients.length}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">⏳ منتظر: {pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">تم التحصيل</p>
          <p className="text-xl font-bold text-emerald-600">{collectedCount}</p>
          <p className="text-xs text-gray-400 mt-1">{formatCurrency(collectedAmount)}</p>
        </div>
        <div className="col-span-2 bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs text-blue-600">الإجمالي المتوقع</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalAmount)}</p>
          {totalAmount > 0 && (
            <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((collectedAmount / totalAmount) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ✅ Legend للألوان */}
      <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> محصّل</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> متأخر</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> إنتاج جديد</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> تحصيل عادي</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      {dueClients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد دفعات مستحقة لهذا الشهر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dueClients.map((client) => {
            const isCollected = collectedIds.has(client.id);
            const isNew       = isNewProductionMonth(client, selectedMonth, selectedYear);
            const isLate      = client.status === 'متأخر';
            const amount      = calculatePaymentAmount(client.annualTarget, client.paymentMethod);

            return (
              <div
                key={client.id}
                className={`rounded-2xl p-4 border transition-all shadow-sm ${cardClasses(client, isCollected, isNew)}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClasses(client, isCollected, isNew)}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">{client.clientName}</p>
                      {/* ✅ شارة المتأخر */}
                      {isLate && !isCollected && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-lg font-medium flex items-center gap-0.5">
                          <AlertTriangle size={10} /> متأخر
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {client.agentName} · {client.paymentMethod}
                      {isNew && <span className="mr-1.5 text-blue-600 font-medium">• إنتاج جديد</span>}
                    </p>
                  </div>

                  <div className="text-left flex-shrink-0 mr-2">
                    <p className={`font-bold text-sm ${isLate && !isCollected ? 'text-red-700' : 'text-gray-900'}`}>
                      {formatCurrency(amount)}
                    </p>
                    {isCollected && <p className="text-xs text-emerald-600 font-medium">✓ تم</p>}
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    {client.phone && !isCollected && (
                      <button
                        onClick={() => handleWhatsApp(client)}
                        className="p-1.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      >
                        <MessageCircle size={15} />
                      </button>
                    )}
                    {isCollected ? (
                      <button
                        onClick={() => handleUndo(client.id)}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-xs font-medium"
                      >
                        إلغاء
                      </button>
                    ) : (
                      <button
                        onClick={() => openConfirm(client)}
                        className={`px-3 py-1.5 rounded-xl text-white transition-colors text-xs font-medium flex items-center gap-1 ${
                          isLate ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <CheckCircle2 size={13} /> تحصيل
                      </button>
                    )}
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
