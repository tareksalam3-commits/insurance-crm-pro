import { useState, useMemo, useEffect } from 'react';
import { Bell, CheckCircle2, MessageCircle, Search, Wallet } from 'lucide-react';
import { useClients } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatUtils';
import { MONTH_LIST, YEAR_LIST } from '../types';
import type { Client, PaymentRecord } from '../types';
import { subscribeToPaymentRecords, addPaymentRecord, deletePaymentRecord } from '../services/paymentRecordsService';
import { isCollectionMonth, isNewProductionMonth, calculatePaymentAmount } from '../services/paymentService';
import { updateClient } from '../services/clientService';

const NOW = new Date();

export default function Collections() {
  const { user } = useAuth();
  const { clients } = useClients();
  const [selectedMonth, setSelectedMonth] = useState(MONTH_LIST[NOW.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(NOW.getFullYear());
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  // تتبع الأزرار اللي بتُنفَّذ حالياً لمنع الضغط المزدوج
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.companyId) return;
    const unsub = subscribeToPaymentRecords(
      (data) => setRecords(data),
      user.companyId,
      { month: selectedMonth, year: selectedYear }
    );
    return unsub;
  }, [user?.companyId, selectedMonth, selectedYear]);

  const dueClients = useMemo(() => {
    return clients.filter((c) => {
      if (c.status === 'ملغي') return false;
      const isDue = isCollectionMonth(c, selectedMonth, selectedYear) || isNewProductionMonth(c, selectedMonth, selectedYear);
      if (!isDue) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return c.clientName.toLowerCase().includes(q) || c.agentName.toLowerCase().includes(q);
    });
  }, [clients, selectedMonth, selectedYear, search]);

  const collectedCount = dueClients.filter((c) => records.some((r) => r.clientId === c.id)).length;
  const pendingCount = dueClients.length - collectedCount;
  const totalAmount = dueClients.reduce((sum, c) => sum + calculatePaymentAmount(c.annualTarget, c.paymentMethod), 0);
  const collectedAmount = dueClients
    .filter((c) => records.some((r) => r.clientId === c.id))
    .reduce((sum, c) => sum + calculatePaymentAmount(c.annualTarget, c.paymentMethod), 0);

  // ── تحصيل: إضافة record + تحديث lastCollectionMonth للعميل ─────────────────
  async function handleCollect(client: Client) {
    if (!user?.companyId) return;
    if (loadingIds.has(client.id)) return; // منع الضغط المزدوج

    setLoadingIds((prev) => new Set(prev).add(client.id));
    try {
      const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);

      // إضافة سجل الدفع
      await addPaymentRecord({
        companyId: user.companyId,
        clientId: client.id,
        clientName: client.clientName,
        agentName: client.agentName,
        group: client.group,
        amount,
        month: selectedMonth,
        year: selectedYear,
        collectedBy: user.displayName,
      });

      // تحديث آخر شهر تحصيل للعميل
      await updateClient(client.id, {
        lastCollectionMonth: `${selectedMonth} ${selectedYear}`,
      });
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(client.id);
        return next;
      });
    }
  }

  // ── إلغاء التحصيل: حذف record فقط (lastCollectionMonth يفضل كما هو) ────────
  async function handleUndo(clientId: string) {
    if (loadingIds.has(clientId)) return;
    setLoadingIds((prev) => new Set(prev).add(clientId));
    try {
      const record = records.find((r) => r.clientId === clientId);
      if (record) await deletePaymentRecord(record.id);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  }

  function handleWhatsApp(client: Client) {
    if (!client.phone) return;
    const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
    const msg = encodeURIComponent(`السلام عليكم ${client.clientName}،\nيرجى العلم باستحقاق دفعة بمبلغ ${formatCurrency(amount)} لشهر ${selectedMonth} ${selectedYear}.\nشكراً`);
    window.open(`https://wa.me/2${client.phone.replace(/^0/, '')}?text=${msg}`, '_blank');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Wallet size={20} className="text-blue-600" />التحصيل
        </h1>
        <div className="flex gap-2">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MONTH_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <div className="h-2 bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.round(collectedAmount / totalAmount * 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            const record = records.find((r) => r.clientId === client.id);
            const isCollected = !!record;
            const isNew = isNewProductionMonth(client, selectedMonth, selectedYear);
            const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
            const isLoading = loadingIds.has(client.id);

            return (
              <div key={client.id} className={`rounded-2xl p-4 border transition-all ${
                isCollected ? 'bg-emerald-50 border-emerald-200' :
                isNew ? 'bg-blue-50 border-blue-200' :
                'bg-white border-gray-100'
              }`}>
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

                  <div className="text-left flex-shrink-0 mr-2">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(amount)}</p>
                    {isCollected && <p className="text-xs text-emerald-600 font-medium">✓ تم بواسطة: {record?.collectedBy}</p>}
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    {client.phone && !isCollected && (
                      <button onClick={() => handleWhatsApp(client)}
                        className="p-1.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                        <MessageCircle size={15} />
                      </button>
                    )}
                    {isCollected ? (
                      <button
                        onClick={() => handleUndo(client.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-xs font-medium disabled:opacity-50">
                        {isLoading ? '...' : 'إلغاء'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCollect(client)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        {isLoading ? '' : 'تم التحصيل'}
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
