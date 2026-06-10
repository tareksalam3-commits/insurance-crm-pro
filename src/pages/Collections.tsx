import { useState, useMemo, useEffect } from 'react';
import { Bell, CheckCircle2, MessageCircle, Search, Wallet, Loader2 } from 'lucide-react';
import { useClients } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatUtils';
import { MONTH_LIST, YEAR_LIST } from '../types';
import type { Client, PaymentRecord } from '../types';
import {
  subscribeToPaymentRecords,
  addPaymentRecord,
  deletePaymentRecord,
  checkPaymentExists,
} from '../services/paymentRecordsService';
import { isCollectionMonth, isNewProductionMonth, calculatePaymentAmount } from '../services/paymentService';

const NOW = new Date();

export default function Collections() {
  const { user } = useAuth();
  const { clients } = useClients();

  const [selectedMonth, setSelectedMonth] = useState(MONTH_LIST[NOW.getMonth()]);
  const [selectedYear,  setSelectedYear]  = useState(NOW.getFullYear());
  const [search,        setSearch]        = useState('');
  const [records,       setRecords]       = useState<PaymentRecord[]>([]);
  const [collectingIds, setCollectingIds] = useState<Set<string>>(new Set());

  // اشتراك realtime في سجلات التحصيل للشهر المختار
  useEffect(() => {
    if (!user?.companyId) return;
    const unsub = subscribeToPaymentRecords(
      (data) => setRecords(data),
      user.companyId,
      { month: selectedMonth, year: selectedYear }
    );
    return unsub;
  }, [user?.companyId, selectedMonth, selectedYear]);

  // فلترة العملاء المستحقة في هذا الشهر
  // كل دور يرى عملاءه فقط (useClients يتولى الفلترة حسب الدور)
  const dueClients = useMemo(() => {
    return clients.filter((c) => {
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
    });
  }, [clients, selectedMonth, selectedYear, search]);

  // إحصائيات
  const collectedCount  = dueClients.filter((c) => records.some((r) => r.clientId === c.id)).length;
  const pendingCount    = dueClients.length - collectedCount;
  const totalAmount     = dueClients.reduce(
    (sum, c) => sum + calculatePaymentAmount(c.annualTarget, c.paymentMethod), 0
  );
  const collectedAmount = dueClients
    .filter((c) => records.some((r) => r.clientId === c.id))
    .reduce((sum, c) => sum + calculatePaymentAmount(c.annualTarget, c.paymentMethod), 0);

  // تحصيل دفعة — مع حماية من التكرار
  async function handleCollect(client: Client) {
    if (!user?.companyId)           return;
    if (collectingIds.has(client.id)) return;

    setCollectingIds((prev) => new Set(prev).add(client.id));
    try {
      // تحقق مزدوج: Firestore
      const alreadyExists = await checkPaymentExists(client.id, selectedMonth, selectedYear);
      if (alreadyExists) return;

      const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
      await addPaymentRecord({
        companyId:   user.companyId,
        clientId:    client.id,
        clientName:  client.clientName,
        agentName:   client.agentName,
        group:       client.group,
        amount,
        month:       selectedMonth,
        year:        selectedYear,
        collectedBy: user.displayName ?? user.email ?? user.uid,
      });
    } catch (err) {
      console.error('خطأ في التحصيل:', err);
      alert('حدث خطأ أثناء التحصيل. حاول مرة أخرى.');
    } finally {
      setCollectingIds((prev) => {
        const next = new Set(prev);
        next.delete(client.id);
        return next;
      });
    }
  }

  async function handleUndo(clientId: string) {
    const record = records.find((r) => r.clientId === clientId);
    if (record) {
      try {
        await deletePaymentRecord(record.id);
      } catch {
        alert('حدث خطأ أثناء الإلغاء.');
      }
    }
  }

  function handleWhatsApp(client: Client) {
    if (!client.phone) return;
    const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
    const cleanPhone = client.phone.replace(/[\s\-]/g, '');
    const msg = encodeURIComponent(
      `السلام عليكم ${client.clientName}،\nيرجى العلم باستحقاق دفعة بمبلغ ${formatCurrency(amount)} لشهر ${selectedMonth} ${selectedYear}.\nشكراً`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Wallet size={20} className="text-blue-600" />
          التحصيل
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
                style={{ width: `${Math.min(100, Math.round(collectedAmount / totalAmount * 100))}%` }}
              />
            </div>
          )}
        </div>
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
            const record      = records.find((r) => r.clientId === client.id);
            const isCollected = !!record;
            const isNew       = isNewProductionMonth(client, selectedMonth, selectedYear);
            const amount      = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
            const isLoading   = collectingIds.has(client.id);

            return (
              <div
                key={client.id}
                className={`rounded-2xl p-4 border transition-all ${
                  isCollected ? 'bg-emerald-50 border-emerald-200' :
                  isNew       ? 'bg-blue-50 border-blue-200' :
                                'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isCollected ? 'bg-emerald-500' : isNew ? 'bg-blue-500' : 'bg-amber-400'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{client.clientName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {client.agentName} · {client.paymentMethod}
                      {isNew && <span className="mr-1.5 text-blue-600 font-medium">• إنتاج جديد</span>}
                    </p>
                  </div>

                  <div className="text-left flex-shrink-0 mx-2">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(amount)}</p>
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
                        onClick={() => handleCollect(client)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed min-w-[72px] justify-center"
                      >
                        {isLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={13} />
                            تحصيل
                          </>
                        )}
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
