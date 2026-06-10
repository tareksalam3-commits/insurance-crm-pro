import { useState, useMemo, useEffect } from 'react';
import { UserCircle2, TrendingUp, Target, Users, Award } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClients, useAgents } from '../hooks/useData';
import { subscribeToPaymentRecords } from '../services/paymentRecordsService';
import { generateMonthlyReport, isCollectionMonth, isNewProductionMonth, calculatePaymentAmount } from '../services/paymentService';
import { MONTH_LIST, YEAR_LIST } from '../types';
import { formatCurrency, formatPercent, getColorByRate, getMotivationMessage } from '../utils/formatUtils';
import type { PaymentRecord } from '../types';

export default function MyDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(MONTH_LIST[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<PaymentRecord[]>([]);

  const { clients } = useClients();
  const { agents } = useAgents();

  useEffect(() => {
    if (!user?.companyId) return;
    const unsub = subscribeToPaymentRecords(
      setRecords,
      user.companyId,
      { month: selectedMonth, year: selectedYear, agentName: user.displayName }
    );
    return unsub;
  }, [user?.companyId, user?.displayName, selectedMonth, selectedYear]);

  const myClients = useMemo(() =>
    clients.filter((c) => c.agentName === user?.displayName),
    [clients, user?.displayName]
  );

  const myAgent = useMemo(() =>
    agents.find((a) => a.name === user?.displayName),
    [agents, user?.displayName]
  );

  const report = useMemo(
    () => generateMonthlyReport(agents, myClients, selectedMonth, selectedYear),
    [agents, myClients, selectedMonth, selectedYear]
  );

  const myPerf = report.performanceMatrix.find((p) => p.name === user?.displayName);
  const target = myAgent?.target ?? 0;
  const total = myPerf?.totalProduction ?? 0;
  const achievementRate = target > 0 ? total / target : 0;
  const colors = getColorByRate(achievementRate);

  const dueThisMonth = myClients.filter(
    (c) => c.status !== 'ملغي' && (
      isCollectionMonth(c, selectedMonth, selectedYear) ||
      isNewProductionMonth(c, selectedMonth, selectedYear)
    )
  );

  const collectedThisMonth = dueThisMonth.filter((c) =>
    records.some((r) => r.clientId === c.id)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCircle2 size={20} className="text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">أدائي</h1>
        </div>
        <div className="flex gap-2">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value as typeof selectedMonth)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MONTH_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {YEAR_LIST.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-gradient-to-br from-blue-600 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-blue-100 text-xs">مرحباً</p>
        <p className="text-xl font-bold mt-0.5">{user?.displayName}</p>
        <p className="text-blue-200 text-sm mt-0.5">{myAgent ? `مجموعة: ${myAgent.group}` : ''}</p>
      </div>

      {/* Motivation */}
      {target > 0 && (
        <div className={`${colors.bg} ${colors.border} border rounded-2xl p-4`}>
          <p className={`font-bold text-sm ${colors.text}`}>{getMotivationMessage(achievementRate)}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-2 ${colors.bar} rounded-full`} style={{ width: `${Math.min(achievementRate * 100, 100)}%` }} />
            </div>
            <span className={`text-sm font-bold ${colors.text} flex-shrink-0`}>{formatPercent(achievementRate)}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp size={12} /> الإنتاج الكلي</p>
          <p className={`text-lg font-bold mt-1 ${colors.text}`}>{formatCurrency(total)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Target size={12} /> التارجت</p>
          <p className="text-lg font-bold mt-1 text-gray-800">{formatCurrency(target)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Award size={12} /> إنتاج جديد</p>
          <p className="text-lg font-bold mt-1 text-emerald-700">{formatCurrency(myPerf?.newProduction ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Users size={12} /> إجمالي العملاء</p>
          <p className="text-lg font-bold mt-1 text-gray-800">{myClients.length}</p>
        </div>
      </div>

      {/* Due This Month */}
      <div className="space-y-2">
        <h2 className="font-bold text-gray-800 text-sm">
          دفعات {selectedMonth} ({collectedThisMonth.length}/{dueThisMonth.length} تم التحصيل)
        </h2>
        {dueThisMonth.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">لا توجد دفعات مستحقة هذا الشهر</div>
        ) : (
          dueThisMonth.map((c) => {
            const collected = records.some((r) => r.clientId === c.id);
            const isNew = isNewProductionMonth(c, selectedMonth, selectedYear);
            const amount = calculatePaymentAmount(c.annualTarget, c.paymentMethod);
            return (
              <div key={c.id} className={`rounded-2xl p-4 border ${collected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{c.clientName}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{c.paymentMethod}</span>
                      {isNew && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">إنتاج جديد</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(amount)}</p>
                    {collected && <p className="text-xs text-emerald-600">✓ تم</p>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
