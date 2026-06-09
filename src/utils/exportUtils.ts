import type { Client, Agent, AgentPerformance } from '../types';

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToExcel(data: Record<string, any>[], sheetName: string, filename: string) {
  try {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch {
    exportToCSV(data, filename);
  }
}

export function clientsToExportData(clients: Client[]) {
  return clients.map((c) => ({
    'اسم العميل': c.clientName,
    'الوكيل': c.agentName,
    'المجموعة': c.group,
    'شهر البداية': c.startMonth,
    'سنة البداية': c.startYear,
    'التارجت السنوي': c.annualTarget,
    'طريقة السداد': c.paymentMethod,
    'نوع الوثيقة': c.insuranceType ?? '',
    'رقم الوثيقة': c.policyNumber ?? '',
    'رقم الهاتف': c.phone ?? '',
    'الحالة': c.status,
    'ملاحظات': c.notes ?? '',
  }));
}

export function performanceToExportData(matrix: AgentPerformance[]) {
  return matrix.map((a) => ({
    'الوكيل': a.name,
    'المجموعة': a.group,
    'التارجت': a.target,
    'إنتاج جديد': a.newProduction,
    'تحصيل': a.collection,
    'إجمالي الإنتاج': a.totalProduction,
    'نسبة التحقيق': `${Math.round(a.achievementRate * 100)}%`,
    'عدد العملاء': a.clientsCount,
  }));
}
