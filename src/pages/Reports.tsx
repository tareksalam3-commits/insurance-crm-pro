import { useState, useMemo } from 'react';
import { FileBarChart, Download, TrendingUp, Users, Target, Award } from 'lucide-react';
import { useClients, useAgents } from '../hooks/useData';
import { generateMonthlyReport } from '../services/paymentService';
import { MONTH_LIST, YEAR_LIST } from '../types';
import { formatCurrency, formatPercent, getColorByRate } from '../utils/formatUtils';
import { exportToExcel, performanceToExportData } from '../utils/exportUtils';

function ProgressBar({ rate }: { rate: number }) {
  const colors = getColorByRate(rate);
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
      <div className={`h-1.5 ${colors.bar} rounded-full`} style={{ width: `${Math.min(rate * 100, 100)}%` }} />
    </div>
  );
}

export default function Reports() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(MONTH_LIST[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterGroup, setFilterGroup] = useState('');

  const { clients } = useClients();
  const { agents } = useAgents();

  const groups = [...new Set(agents.map((a) => a.group))].filter(Boolean);

  const report = useMemo(
    () => generateMonthlyReport(agents, clients, selectedMonth, selectedYear),
    [agents, clients, selectedMonth, selectedYear]
  );

  const { unitSummary: us, performanceMatrix, groupSummaries, leadershipProduction } = report;

  const filteredMatrix = filterGroup
    ? performanceMatrix.filter((a) => a.group === filterGroup)
    : performanceMatrix;

  const unitColors = getColorByRate(us.achievementRate);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FileBarChart size={20} className="text-blue-600" /> التقارير
        </h1>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value as typeof selectedMonth)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MONTH_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {YEAR_LIST.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => exportToExcel(performanceToExportData(filteredMatrix), 'تقرير الأداء', `report-${selectedMonth}-${selectedYear}`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
            <Download size={14} /> تصدير
          </button>
        </div>
      </div>

      {/* Unit Summary */}
      <div className={`rounded-2xl p-5 border ${unitColors.bg} ${unitColors.border}`}>
        <h2 className={`font-bold text-sm mb-3 ${unitColors.text}`}>ملخص الفرع — {selectedMonth} {selectedYear}</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'الإنتاج الكلي', value: formatCurrency(us.total), icon: <TrendingUp size={16} /> },
            { label: 'إنتاج جديد',    value: formatCurrency(us.newProd), icon: <Award size={16} /> },
            { label: 'التحصيل',       value: formatCurrency(us.coll), icon: <Target size={16} /> },
            { label: 'التارجت',       value: formatCurrency(us.target), icon: <Users size={16} /> },
          ].map((item) => (
            <div key={item.label} className="bg-white/70 rounded-xl p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1">{item.icon}{item.label}</p>
              <p className={`font-bold text-sm mt-0.5 ${unitColors.text}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className={unitColors.text}>نسبة التحقيق</span>
            <span className={`font-bold ${unitColors.text}`}>{formatPercent(us.achievementRate)}</span>
          </div>
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            <div className={`h-2 ${unitColors.bar} rounded-full transition-all`} style={{ width: `${Math.min(us.achievementRate * 100, 100)}%` }} />
          </div>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-600">
          <span>وكلاء: {us.totalAgents}</span>
          <span className="text-emerald-600">حققوا التارجت: {us.targetAchievers}</span>
          <span className="text-red-500">دون 50%: {us.underperformersCount}</span>
        </div>
      </div>

      {/* Group Summaries */}
      {groupSummaries.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-800 text-sm">أداء المجموعات</h2>
          {groupSummaries.map((g) => {
            const gc = getColorByRate(g.achievementRate);
            return (
              <div key={g.name} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{g.name}</span>
                    <span className="text-xs text-gray-400 mr-2">{g.count} وكيل</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${gc.badge}`}>{formatPercent(g.achievementRate)}</span>
                </div>
                <ProgressBar rate={g.achievementRate} />
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">إنتاج جديد</p>
                    <p className="text-xs font-bold text-gray-800">{formatCurrency(g.newProd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">تحصيل</p>
                    <p className="text-xs font-bold text-gray-800">{formatCurrency(g.coll)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">إجمالي</p>
                    <p className={`text-xs font-bold ${gc.text}`}>{formatCurrency(g.total)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Performance Filter */}
      {groups.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterGroup('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${!filterGroup ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            الكل
          </button>
          {groups.map((g) => (
            <button key={g} onClick={() => setFilterGroup(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filterGroup === g ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Performance Matrix */}
      {filteredMatrix.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-gray-800 text-sm">أداء الوكلاء ({filteredMatrix.length})</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">الوكيل</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">إنتاج</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMatrix.map((a, i) => {
                  const ac = getColorByRate(a.achievementRate);
                  return (
                    <tr key={a.name} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900 text-xs">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.group}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-xs text-gray-900">{formatCurrency(a.totalProduction)}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(a.newProduction)} + {formatCurrency(a.collection)}</p>
                      </td>
                      <td className="px-3 py-3">
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

      {/* Leadership */}
      {leadershipProduction.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-gray-800 text-sm">إنتاج القيادات</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">الاسم</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">الدور</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">إنتاج</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">عملاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leadershipProduction.map((l) => (
                  <tr key={l.name} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900 text-xs">{l.name}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{l.role}</td>
                    <td className="px-3 py-3 font-bold text-xs text-gray-900">{formatCurrency(l.total)}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{l.clientsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
