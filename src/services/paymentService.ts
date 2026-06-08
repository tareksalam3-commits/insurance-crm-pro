import { MONTH_LIST } from '../types';
import type {
  Client, Agent, AgentPerformance, GroupSummary,
  UnitSummary, MonthlyReportData, LeadershipProduction, PaymentMethod, ProductionType,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calculatePaymentAmount(
  annualTarget: number,
  paymentMethod: PaymentMethod
): number {
  if (!annualTarget || annualTarget <= 0) return 0;
  switch (paymentMethod) {
    case 'شهري':      return Math.round(annualTarget / 12);
    case 'ربع سنوي': return Math.round(annualTarget / 4);
    case 'نصف سنوي': return Math.round(annualTarget / 2);
    case 'سنوي':      return annualTarget;
    default:          return 0;
  }
}

export function calculateLastCollectionMonth(
  startMonth: string,
  paymentMethod: PaymentMethod
): string {
  if (paymentMethod === 'سنوي') return 'لا يوجد تحصيل';
  const startIdx = MONTH_LIST.indexOf(startMonth as any);
  if (startIdx === -1) return startMonth;
  let interval: number;
  let count: number;
  switch (paymentMethod) {
    case 'شهري':      interval = 1; count = 11; break;
    case 'ربع سنوي': interval = 3; count = 3;  break;
    case 'نصف سنوي': interval = 6; count = 1;  break;
    default: return startMonth;
  }
  const lastIdx = (startIdx + count * interval) % 12;
  return MONTH_LIST[lastIdx];
}

function getMonthIndex(month: string, year: number): number {
  const idx = MONTH_LIST.indexOf(month as any);
  if (idx === -1) return -1;
  return year * 12 + idx;
}

function isValidPaymentMonth(method: PaymentMethod, monthsPassed: number): boolean {
  if (monthsPassed <= 0) return false;
  switch (method) {
    case 'شهري':      return monthsPassed <= 11;
    case 'ربع سنوي': return monthsPassed % 3 === 0 && monthsPassed < 12;
    case 'نصف سنوي': return monthsPassed === 6;
    case 'سنوي':      return false;
    default:          return false;
  }
}

export function isCollectionMonth(
  client: Client,
  selectedMonth: string,
  selectedYear: number
): boolean {
  const startIdx    = MONTH_LIST.indexOf(client.startMonth as any);
  const selectedIdx = MONTH_LIST.indexOf(selectedMonth as any);
  if (startIdx === -1 || selectedIdx === -1) return false;
  const startAbs    = (client.startYear ?? selectedYear) * 12 + startIdx;
  const selectedAbs = selectedYear * 12 + selectedIdx;
  const monthsPassed = selectedAbs - startAbs;
  if (monthsPassed < 0 || monthsPassed >= 12) return false;
  if (monthsPassed === 0) return false;
  return isValidPaymentMonth(client.paymentMethod, monthsPassed);
}

export function isNewProductionMonth(
  client: Client,
  selectedMonth: string,
  selectedYear: number
): boolean {
  const startIdx    = MONTH_LIST.indexOf(client.startMonth as any);
  const selectedIdx = MONTH_LIST.indexOf(selectedMonth as any);
  if (startIdx === -1 || selectedIdx === -1) return false;
  const startAbs    = (client.startYear ?? selectedYear) * 12 + startIdx;
  const selectedAbs = selectedYear * 12 + selectedIdx;
  return selectedAbs === startAbs;
}

// ─── Performance Matrix (agents only) ────────────────────────────────────────

export function generatePerformanceMatrix(
  agents: Agent[],
  clients: Client[],
  selectedMonth: string,
  selectedYear: number
): AgentPerformance[] {
  const matrix: Record<string, AgentPerformance> = {};

  const realAgents = agents.filter((a) => a.productionType === 'agent');
  for (const agent of realAgents) {
    matrix[agent.name] = {
      name: agent.name, group: agent.group, target: agent.target || 0,
      newProduction: 0, collection: 0, totalProduction: 0,
      clientsCount: 0, achievementRate: 0, productionType: 'agent',
    };
  }

  const currentIndex = getMonthIndex(selectedMonth, selectedYear);
  if (currentIndex === -1) return Object.values(matrix);

  for (const client of clients) {
    if (client.productionType !== 'agent') continue;
    const perf = matrix[client.agentName];
    if (!perf) continue;

    const clientYear = client.startYear ?? selectedYear;
    const startIndex = getMonthIndex(client.startMonth, clientYear);
    if (startIndex === -1) continue;

    const monthsPassed = currentIndex - startIndex;
    if (monthsPassed < 0 || monthsPassed >= 12) continue;

    // ✅ دايماً من annualTarget
    const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);

    if (monthsPassed === 0) {
      perf.newProduction += amount;
      perf.clientsCount  += 1;
    } else if (isValidPaymentMonth(client.paymentMethod, monthsPassed)) {
      perf.collection   += amount;
      perf.clientsCount += 1;
    } else {
      continue;
    }

    perf.totalProduction = perf.newProduction + perf.collection;
    perf.achievementRate = perf.target > 0 ? perf.totalProduction / perf.target : 0;
  }

  return Object.values(matrix).sort((a, b) => b.totalProduction - a.totalProduction);
}

// ─── Leadership Production (all non-agent) ────────────────────────────────────

export function generateLeadershipProduction(
  agents: Agent[],
  clients: Client[],
  selectedMonth: string,
  selectedYear: number
): LeadershipProduction[] {
  const result: Record<string, LeadershipProduction> = {};

  const leaders = agents.filter((a) => a.productionType !== 'agent');
  for (const l of leaders) {
    result[l.name] = { name: l.name, role: l.productionType, newProduction: 0, collection: 0, total: 0, clientsCount: 0 };
  }

  const currentIndex = getMonthIndex(selectedMonth, selectedYear);
  if (currentIndex === -1) return Object.values(result);

  for (const client of clients) {
    if (client.productionType === 'agent') continue;
    const rec = result[client.agentName];
    if (!rec) continue;

    const clientYear = client.startYear ?? selectedYear;
    const startIndex = getMonthIndex(client.startMonth, clientYear);
    if (startIndex === -1) continue;

    const monthsPassed = currentIndex - startIndex;
    if (monthsPassed < 0 || monthsPassed >= 12) continue;

    const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);

    if (monthsPassed === 0) {
      rec.newProduction += amount;
      rec.clientsCount  += 1;
      rec.total         += amount;
    } else if (isValidPaymentMonth(client.paymentMethod, monthsPassed)) {
      rec.collection   += amount;
      rec.clientsCount += 1;
      rec.total        += amount;
    }
  }

  return Object.values(result).sort((a, b) => b.total - a.total);
}

// ─── Group Summaries ──────────────────────────────────────────────────────────

export function generateGroupSummaries(
  performanceMatrix: AgentPerformance[],
  clients: Client[],
  agents: Agent[],
  selectedMonth: string,
  selectedYear: number
): GroupSummary[] {
  // collect unique groups
  const groupNames = [...new Set(agents.map((a) => a.group))].filter(Boolean);
  const groups: Record<string, GroupSummary> = {};
  for (const g of groupNames) {
    groups[g] = { name: g, newProd: 0, coll: 0, total: 0, target: 0, count: 0, achievementRate: 0, evaluation: '', leaderProduction: 0 };
  }

  for (const item of performanceMatrix) {
    const grp = groups[item.group];
    if (!grp) continue;
    grp.newProd += item.newProduction;
    grp.coll    += item.collection;
    grp.total   += item.totalProduction;
    grp.target  += item.target;
    grp.count   += 1;
  }

  const currentIndex = getMonthIndex(selectedMonth, selectedYear);

  // add group_leader production into their group total
  for (const client of clients) {
    if (client.productionType !== 'group_leader') continue;
    const grp = groups[client.group];
    if (!grp || currentIndex === -1) continue;

    const clientYear = client.startYear ?? selectedYear;
    const startIndex = getMonthIndex(client.startMonth, clientYear);
    if (startIndex === -1) continue;
    const monthsPassed = currentIndex - startIndex;
    if (monthsPassed < 0 || monthsPassed >= 12) continue;

    const amount = calculatePaymentAmount(client.annualTarget, client.paymentMethod);
    if (monthsPassed === 0) {
      grp.newProd += amount;
      grp.total   += amount;
      grp.leaderProduction = (grp.leaderProduction ?? 0) + amount;
    } else if (isValidPaymentMonth(client.paymentMethod, monthsPassed)) {
      grp.coll  += amount;
      grp.total += amount;
      grp.leaderProduction = (grp.leaderProduction ?? 0) + amount;
    }
  }

  return Object.values(groups).map((g) => {
    const achievementRate = g.target > 0 ? g.total / g.target : 0;
    const evaluation =
      achievementRate >= 1    ? 'ممتاز جداً'   :
      achievementRate >= 0.75 ? 'جيد'           :
      achievementRate >= 0.5  ? 'مقبول'         :
                                'دون المستوى';
    return { ...g, achievementRate, evaluation };
  }).sort((a, b) => b.total - a.total);
}

// ─── Unit Summary ─────────────────────────────────────────────────────────────

export function generateUnitSummary(
  performanceMatrix: AgentPerformance[],
  leadershipProduction: LeadershipProduction[],
  agents: Agent[],
): UnitSummary {
  let newProd = 0, coll = 0;

  for (const item of performanceMatrix) {
    newProd += item.newProduction;
    coll    += item.collection;
  }
  for (const l of leadershipProduction) {
    newProd += l.newProduction;
    coll    += l.collection;
  }

  const total = newProd + coll;
  const totalTarget = agents.filter((a) => a.productionType === 'agent').reduce((s, a) => s + (a.target || 0), 0);
  const achievementRate = totalTarget > 0 ? total / totalTarget : 0;
  const evaluation =
    achievementRate >= 2    ? 'أداء أسطوري! الفرع بيكسر كل الأرقام!'  :
    achievementRate >= 1.5  ? 'ممتاز جداً! استمروا في هذا التميز!'     :
    achievementRate >= 1    ? 'تم تحقيق التارجت! عمل رائع!'             :
    achievementRate >= 0.75 ? 'قريبين جداً! دفعة صغيرة وهنوصل!'        :
    achievementRate >= 0.5  ? 'في الطريق الصح! ركزوا ويلا!'             :
                              'يلا نتحرك! الفرصة لسه موجودة!';

  const targetAchievers      = performanceMatrix.filter((a) => a.target > 0 && a.totalProduction >= a.target).length;
  const underperformersCount = performanceMatrix.filter((a) => a.target > 0 && a.totalProduction / a.target < 0.5).length;
  const totalAgents          = agents.filter((a) => a.productionType === 'agent').length;

  return { newProd, coll, total, target: totalTarget, achievementRate, evaluation, totalAgents, targetAchievers, underperformersCount };
}

// ─── Monthly Report ───────────────────────────────────────────────────────────

export function generateMonthlyReport(
  agents: Agent[],
  clients: Client[],
  selectedMonth: string,
  selectedYear: number
): MonthlyReportData {
  const performanceMatrix   = generatePerformanceMatrix(agents, clients, selectedMonth, selectedYear);
  const leadershipProduction = generateLeadershipProduction(agents, clients, selectedMonth, selectedYear);
  const groupSummaries      = generateGroupSummaries(performanceMatrix, clients, agents, selectedMonth, selectedYear);
  const unitSummary         = generateUnitSummary(performanceMatrix, leadershipProduction, agents);

  const champions      = [...performanceMatrix].filter((a) => a.totalProduction > 0).slice(0, 3);
  const underperformers = [...performanceMatrix]
    .filter((a) => a.target > 0 && a.totalProduction / a.target < 0.5)
    .sort((a, b) => a.totalProduction - b.totalProduction);

  return { month: selectedMonth, year: selectedYear, performanceMatrix, groupSummaries, unitSummary, champions, underperformers, leadershipProduction };
}
