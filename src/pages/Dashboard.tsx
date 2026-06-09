import { useState, useMemo, type ReactNode } from 'react';
import { TrendingUp, Target, Award, Users, Activity, Crown, Star, AlertTriangle, Building2, BarChart3 } from 'lucide-react';
import { MONTH_LIST, YEAR_LIST, ROLE_LABELS } from '../types';
import { generateMonthlyReport } from '../services/paymentService';
import { useClients, useAgents } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatPercent, getColorByRate, getMotivationMessage } from '../utils/formatUtils';

function StatCard({ title, value, icon, color = 'text-gray-700', bgColor = 'bg-gray-50', subtitle }: {
  title: string; value: string | number; icon: ReactNode; color?: string; bgColor?: string; subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className={`text-2xl font-bold mt-1.5 ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0 mr-3 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ rate }: { rate: number }) {
  const colors = getColorByRate(rate);
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-2 ${colors.bar} rounded-full transition-all duration-500`} style={{ width: `${Math.min(rate * 100, 100)}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(MONTH_LIST[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { clients } = useClients();
  const { agents } = useAgents();

  // فلترة البيانات حسب الدور
  const filteredAgents = useMemo(() => {
    if (!user) return agents;
    switch (user.role) {
      case 'super_admin':
      case 'sales_manager':
        // يشوف الكل
        return agents;
      case 'general_supervisor':
        // يشوف المراقبين والمجموعات التابعة له
        return agents.filter((a) => a.supervisorId === user.uid || a.productionType === 'general_supervisor');
      case 'supervisor':
        // يشوف مجموعاته بس
        return agents.filter((a) => a.supervisorId === user.uid || a.productionType === 'supervisor');
      case 'group_leader':
        // يشوف أعضاء مجموعته بس
        return agents.filter((a) => a.supervisorId === user.uid || a.productionType === 'group_leader');
      default:
        return agents;
    }
  }, [agents, user]);

  const filteredClients = useMemo(() => {
    if (!user) return clients;
    switch (user.role) {
      case 'super_admin':
      case 'sales_manager':
        return clients;
      case 'general_supervisor':
        return clients.filter((c) =>
          filteredAgents.some((a) => a.name === c.agentName)
        );
      case 'supervisor':
        return clients.filter((c) =>
          filteredAgents.some((a) => a.name === c.agentName)
        );
      case 'group_leader':
        return clients.filter((c) =>
          filteredAgents.some((a) => a.name === c.agentName)
        );
      default:
        return clients;
    }
  }, [clients, filteredAgents, user]);

  const report = useMemo(
    () => generateMonthlyReport(filteredAgents, filteredClients, selectedMonth, selectedYear),
    [filteredAgents, filteredClients, selectedMonth, selectedYear]
  );

  const { unitSummary: us, performanceMatrix, groupSummaries, champions, underperformers, leadershipProduction } = report;
  const colors = getColorByRate(us.achievementRate);

  const roleLabel = user ? ROLE_LABELS[user.role] : '';

  return (
    <div className="space-y-5">

      {/* Title + Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-xs text-gray-400">{roleLabel}</p>
        </div>
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

      {/* Motivation Banner */}
      <div className={`${colors.bg} ${colors.border} border rounded-2xl p-4`}>
        <p className={`font-bold text-sm ${colors.text}`}>{getMotivationMessage(us.achievementRate)}</p>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar rate={us.achievementRate} />
          <span className={`text-sm font-bold ${colors.text} flex-shrink-0`}>{formatPercent(us.achievementRate)}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="الإنتاج الكلي"   value={formatCurrency(us.total)}   icon={<TrendingUp size={20} />} color="text-blue-700"    bgColor="bg-blue-50" />
        <StatCard title="إنتاج جديد"      value={formatCurrency(us.newProd)} icon={<Star size={20} />}       color="text-emerald-700" bgColor="bg-emerald-50" />
        <StatCard title="التحصيل"         value={formatCurrency(us.coll)}    icon={<Activity size={20} />}   color="text-amber-700"   bgColor="bg-amber-50" />
        <StatCard title="التارجت الكلي"   value={formatCurrency(us.target)}  icon={<Target size={20} />}     color="text-purple-700"  bgColor="bg-purple-50" />
        <StatCard title="إجمالي الوكلاء" value={us.totalAgents}             icon={<Users size={20} />}      color="text-gray-700"    bgColor="bg-gray-50" />
        <StatCard title="حققوا التارجت"  value={us.targetAchievers}         icon={<Award size={20} />}      color="text-emerald-700" bgColor="bg-emerald-50"
          subtitle={`دون 50%: ${us.underperformersCount}`} />
      </div>

      {/* Group Summaries */}
      {groupSummaries.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" /> أداء المجموعات
          </h2>
          {groupSummaries.map((g) => {
            const gc = getColorByRate(g.achievementRate);
            return (
              <div key={g.name} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-900 text-sm">{g.name}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${gc.badge}`}>{formatPercent(g.achievementRate)}</span>
                </div>
                <ProgressBar rate={g.achievementRate} />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>إنتاج: {formatCurrency(g.total)}</span>
                  <span>تارجت: {formatCurrency(g.target)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Champions */}
      {champions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Crown size={16} className="text-yellow-500" /> أبطال الشهر
          </h2>
          {champions.map((c, i) => (
            <div key={c.name} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                i === 0 ? 'bg-yellow-100 text-yellow-700' :
                i === 1 ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-100 text-amber-700'
              }`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                <p className="text-xs text-gray-500">{c.group}</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{formatCurrency(c.totalProduction)}</p>
                <p className="text-xs text-emerald-600">{formatPercent(c.achievementRate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Performance Matrix */}
      {performanceMatrix.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" /> أداء الوكلاء
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">الوكيل</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">الإنتاج</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {performanceMatrix.map((a) => {
                  const ac = getColorByRate(a.achievementRate);
                  return (
                    <tr key={a.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.group}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900 text-xs">{formatCurrency(a.totalProduction)}</p>
                        <p className="text-xs text-gray-400">من {formatCurrency(a.target)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${ac.badge}`}>{formatPercent(a.achievementRate)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leadership Production */}
      {leadershipProduction.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-gray-800 text-sm">إنتاج القيادات</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">الاسم</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">الدور</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">الإنتاج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leadershipProduction.map((l) => (
                  <tr key={l.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 text-xs">{l.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{ROLE_LABELS[l.role as keyof typeof ROLE_LABELS] ?? l.role}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 text-xs">{formatCurrency(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Underperformers */}
      {underperformers.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" /> يحتاجون متابعة (أقل من 50%)
          </h2>
          {underperformers.map((a) => (
            <div key={a.name} className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{a.name}</p>
                <p className="text-xs text-gray-500">{a.group}</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-red-700 text-sm">{formatPercent(a.achievementRate)}</p>
                <p className="text-xs text-gray-500">{formatCurrency(a.totalProduction)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
