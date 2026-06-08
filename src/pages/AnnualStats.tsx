import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useClients, useAgents } from '../hooks/useData';
import { generateMonthlyReport } from '../services/paymentService';
import { MONTH_LIST, YEAR_LIST } from '../types';
import { formatCurrency, getColorByRate } from '../utils/formatUtils';

export default function AnnualStats() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { clients } = useClients();
  const { agents } = useAgents();

  const monthlyData = useMemo(() => {
    return MONTH_LIST.map((month) => {
      const report = generateMonthlyReport(agents, clients, month, selectedYear);
      return {
        month,
        total: report.unitSummary.total,
        newProd: report.unitSummary.newProd,
        coll: report.unitSummary.coll,
        target: report.unitSummary.target,
        achievementRate: report.unitSummary.achievementRate,
      };
    });
  }, [agents, clients, selectedYear]);

  const maxTotal = Math.max(...monthlyData.map((d) => d.total), 1);
  const yearTotal = monthlyData.reduce((s, d) => s + d.total, 0);
  const yearNewProd = monthlyData.reduce((s, d) => s + d.newProd, 0);
  const yearColl = monthlyData.reduce((s, d) => s + d.coll, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" /> الإحصائيات السنوية
        </h1>
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {YEAR_LIST.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Year Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-500">إجمالي السنة</p>
          <p className="text-base font-bold text-blue-700 mt-1">{formatCurrency(yearTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-500">إنتاج جديد</p>
          <p className="text-base font-bold text-emerald-700 mt-1">{formatCurrency(yearNewProd)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-500">تحصيل</p>
          <p className="text-base font-bold text-amber-700 mt-1">{formatCurrency(yearColl)}</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 text-sm mb-4">الإنتاج الشهري — {selectedYear}</h2>
        <div className="flex items-end gap-1.5 h-40">
          {monthlyData.map((d) => {
            const height = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0;
            const colors = getColorByRate(d.achievementRate);
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
                  <div
                    className={`w-full rounded-t-lg ${colors.bar} transition-all duration-500`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${d.month}: ${formatCurrency(d.total)}`}
                  />
                </div>
                <span className="text-xs text-gray-400" style={{ fontSize: '9px' }}>
                  {d.month.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-3 text-xs text-gray-500 justify-center flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> ≥ 100%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> ≥ 75%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> ≥ 50%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> &lt; 50%</span>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">الشهر</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">إجمالي</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {monthlyData.map((d) => {
              const dc = getColorByRate(d.achievementRate);
              return (
                <tr key={d.month} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-xs font-medium text-gray-800">{d.month}</td>
                  <td className="px-3 py-3 text-xs font-bold text-gray-900">{formatCurrency(d.total)}</td>
                  <td className="px-3 py-3">
                    {d.target > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${dc.badge}`}>
                        {Math.round(d.achievementRate * 100)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
