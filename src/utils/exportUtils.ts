import type { Client, Agent, AgentPerformance, MonthlyReportData, GroupSummary, LeadershipProduction } from '../types';

// ─── CSV fallback ─────────────────────────────────────────────────────────────

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

// ─── Excel export ─────────────────────────────────────────────────────────────

export async function exportToExcel(
  data: Record<string, any>[],
  sheetName: string,
  filename: string
) {
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

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportToPDF(
  htmlContent: string,
  filename: string
): Promise<void> {
  // نفتح نافذة طباعة مع HTML نظيف — أفضل من أي مكتبة خارجية على mobile
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>${filename}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Cairo', 'Segoe UI', sans-serif;
          font-size: 11px;
          color: #111;
          direction: rtl;
          padding: 20px;
        }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; margin: 16px 0 6px; color: #1e40af; border-bottom: 1px solid #bfdbfe; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
        th { background: #eff6ff; color: #1e3a8a; padding: 5px 8px; text-align: right; border: 1px solid #bfdbfe; }
        td { padding: 4px 8px; border: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f8fafc; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        .summary-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; }
        .summary-card .label { font-size: 9px; color: #6b7280; }
        .summary-card .value { font-size: 14px; font-weight: bold; color: #1e40af; margin-top: 2px; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
        .badge-green  { background: #dcfce7; color: #15803d; }
        .badge-blue   { background: #dbeafe; color: #1d4ed8; }
        .badge-amber  { background: #fef3c7; color: #b45309; }
        .badge-red    { background: #fee2e2; color: #b91c1c; }
        .footer { margin-top: 20px; text-align: center; color: #9ca3af; font-size: 9px; }
        @media print {
          body { padding: 10px; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <div class="footer">InsuranceCRM Pro — تم الإنشاء في ${new Date().toLocaleString('ar-EG')}</div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ─── Monthly closing report — HTML builder ────────────────────────────────────

function formatNum(v: number): string {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}م`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}ك`;
  return v.toLocaleString('ar-EG');
}

function rateBadge(rate: number): string {
  const cls =
    rate >= 1    ? 'badge-green'  :
    rate >= 0.75 ? 'badge-blue'   :
    rate >= 0.5  ? 'badge-amber'  :
                   'badge-red';
  return `<span class="badge ${cls}">${Math.round(rate * 100)}%</span>`;
}

export function buildMonthlyClosingHTML(
  report: MonthlyReportData,
  month: string,
  year: number
): string {
  const { unitSummary: us, performanceMatrix, groupSummaries, leadershipProduction } = report;

  // ── Unit summary cards ────────────────────────────────────────
  const summaryCards = `
    <div class="summary-grid">
      <div class="summary-card"><div class="label">الإنتاج الكلي</div><div class="value">${formatNum(us.total)}</div></div>
      <div class="summary-card"><div class="label">إنتاج جديد</div><div class="value">${formatNum(us.newProd)}</div></div>
      <div class="summary-card"><div class="label">تحصيل</div><div class="value">${formatNum(us.coll)}</div></div>
      <div class="summary-card"><div class="label">التارجت</div><div class="value">${formatNum(us.target)}</div></div>
    </div>
    <div class="summary-grid">
      <div class="summary-card"><div class="label">وكلاء</div><div class="value">${us.totalAgents}</div></div>
      <div class="summary-card"><div class="label">حققوا التارجت</div><div class="value">${us.targetAchievers}</div></div>
      <div class="summary-card"><div class="label">دون 50%</div><div class="value">${us.underperformersCount}</div></div>
      <div class="summary-card"><div class="label">نسبة التحقيق</div><div class="value">${Math.round(us.achievementRate * 100)}%</div></div>
    </div>`;

  // ── Groups table ──────────────────────────────────────────────
  const groupRows = groupSummaries.map((g: GroupSummary) => `
    <tr>
      <td>${g.name}</td>
      <td>${g.count}</td>
      <td>${formatNum(g.newProd)}</td>
      <td>${formatNum(g.coll)}</td>
      <td>${formatNum(g.total)}</td>
      <td>${formatNum(g.target)}</td>
      <td>${rateBadge(g.achievementRate)}</td>
    </tr>`).join('');

  const groupsTable = `
    <h2>أداء المجموعات</h2>
    <table>
      <thead>
        <tr><th>المجموعة</th><th>وكلاء</th><th>إنتاج جديد</th><th>تحصيل</th><th>إجمالي</th><th>التارجت</th><th>%</th></tr>
      </thead>
      <tbody>${groupRows}</tbody>
    </table>`;

  // ── Agents table ──────────────────────────────────────────────
  const agentRows = performanceMatrix.map((a: AgentPerformance, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${a.name}</td>
      <td>${a.group}</td>
      <td>${formatNum(a.newProduction)}</td>
      <td>${formatNum(a.collection)}</td>
      <td>${formatNum(a.totalProduction)}</td>
      <td>${formatNum(a.target)}</td>
      <td>${rateBadge(a.achievementRate)}</td>
    </tr>`).join('');

  const agentsTable = `
    <h2>أداء الوكلاء</h2>
    <table>
      <thead>
        <tr><th>#</th><th>الوكيل</th><th>المجموعة</th><th>إنتاج جديد</th><th>تحصيل</th><th>إجمالي</th><th>التارجت</th><th>%</th></tr>
      </thead>
      <tbody>${agentRows}</tbody>
    </table>`;

  // ── Leadership table ──────────────────────────────────────────
  const leaderRows = leadershipProduction.map((l: LeadershipProduction) => `
    <tr>
      <td>${l.name}</td>
      <td>${l.role}</td>
      <td>${formatNum(l.newProduction)}</td>
      <td>${formatNum(l.collection)}</td>
      <td>${formatNum(l.total)}</td>
      <td>${l.clientsCount}</td>
    </tr>`).join('');

  const leaderTable = leaderRows ? `
    <h2>إنتاج القيادات</h2>
    <table>
      <thead>
        <tr><th>الاسم</th><th>الدور</th><th>إنتاج جديد</th><th>تحصيل</th><th>إجمالي</th><th>عملاء</th></tr>
      </thead>
      <tbody>${leaderRows}</tbody>
    </table>` : '';

  return `
    <h1>تقرير تقفيل شهر ${month} ${year}</h1>
    <p style="color:#6b7280;font-size:10px;margin-bottom:12px;">${us.evaluation}</p>
    ${summaryCards}
    ${groupsTable}
    ${agentsTable}
    ${leaderTable}
  `;
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

export function clientsToExportData(clients: Client[]) {
  return clients.map((c) => ({
    'اسم العميل':    c.clientName,
    'الوكيل':        c.agentName,
    'المجموعة':      c.group,
    'شهر البداية':   c.startMonth,
    'سنة البداية':   c.startYear,
    'التارجت السنوي': c.annualTarget,
    'طريقة السداد':  c.paymentMethod,
    'نوع الوثيقة':   c.insuranceType ?? '',
    'رقم الوثيقة':   c.policyNumber  ?? '',
    'رقم الهاتف':    c.phone         ?? '',
    'الحالة':        c.status,
    'ملاحظات':       c.notes         ?? '',
  }));
}

export function performanceToExportData(matrix: AgentPerformance[]) {
  return matrix.map((a) => ({
    'الوكيل':         a.name,
    'المجموعة':       a.group,
    'التارجت':        a.target,
    'إنتاج جديد':    a.newProduction,
    'تحصيل':         a.collection,
    'إجمالي الإنتاج': a.totalProduction,
    'نسبة التحقيق':  `${Math.round(a.achievementRate * 100)}%`,
    'عدد العملاء':   a.clientsCount,
  }));
}

export function monthlyReportToExportData(report: MonthlyReportData) {
  return report.performanceMatrix.map((a) => ({
    'الوكيل':         a.name,
    'المجموعة':       a.group,
    'التارجت':        a.target,
    'إنتاج جديد':    a.newProduction,
    'تحصيل':         a.collection,
    'إجمالي':        a.totalProduction,
    'نسبة التحقيق':  `${Math.round(a.achievementRate * 100)}%`,
    'عدد العملاء':   a.clientsCount,
  }));
}
