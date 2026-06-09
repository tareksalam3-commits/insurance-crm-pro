import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Client, ProductionType } from '../types';
import { calculatePaymentAmount, calculateLastCollectionMonth } from './paymentService';

const COL = 'clients';

// ─── Normalize ────────────────────────────────────────────────────────────────

function normalizeClient(id: string, data: Record<string, any>): Client {
  const productionType: ProductionType = data.productionType ?? 'agent';
  const startYear: number = data.startYear ?? new Date().getFullYear();
  const paymentAmount: number =
    data.paymentAmount && data.paymentAmount > 0
      ? data.paymentAmount
      : calculatePaymentAmount(data.annualTarget ?? 0, data.paymentMethod ?? 'شهري');
  const lastCollectionMonth: string =
    data.lastCollectionMonth ||
    calculateLastCollectionMonth(data.startMonth ?? 'يناير', data.paymentMethod ?? 'شهري');

  return {
    id,
    companyId:           data.companyId          ?? '',
    group:               data.group              ?? '',
    agentName:           data.agentName          ?? '',
    productionType,
    clientName:          data.clientName         ?? '',
    startMonth:          data.startMonth         ?? 'يناير',
    startYear,
    annualTarget:        data.annualTarget       ?? 0,
    paymentMethod:       data.paymentMethod      ?? 'شهري',
    paymentAmount,
    lastCollectionMonth,
    phone:               data.phone,
    policyNumber:        data.policyNumber,
    insuranceCompany:    data.insuranceCompany,
    insuranceType:       data.insuranceType,
    notes:               data.notes,
    status:              data.status             ?? 'نشط',
    createdAt:           data.createdAt,
  };
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export function subscribeToClients(
  callback: (clients: Client[]) => void,
  companyId: string,
  filters?: { agentName?: string; group?: string }
): () => void {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
  ];
  if (filters?.agentName) constraints.push(where('agentName', '==', filters.agentName));
  if (filters?.group)     constraints.push(where('group', '==', filters.group));

  const q = query(collection(db, COL), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalizeClient(d.id, d.data())));
  });
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getClients(
  companyId: string,
  filters?: { agentName?: string; group?: string }
): Promise<Client[]> {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
  ];
  if (filters?.agentName) constraints.push(where('agentName', '==', filters.agentName));
  if (filters?.group)     constraints.push(where('group', '==', filters.group));

  const q = query(collection(db, COL), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeClient(d.id, d.data()));
}

// ─── Add ──────────────────────────────────────────────────────────────────────

export async function addClient(data: Omit<Client, 'id' | 'createdAt'>): Promise<string> {
  const paymentAmount = calculatePaymentAmount(data.annualTarget, data.paymentMethod);
  const lastCollectionMonth = calculateLastCollectionMonth(data.startMonth, data.paymentMethod);
  const ref = await addDoc(collection(db, COL), {
    ...data,
    paymentAmount,
    lastCollectionMonth,
    startYear: data.startYear ?? new Date().getFullYear(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * ✅ FIX: يجيب البيانات الحالية من Firestore قبل حساب paymentAmount
 * عشان لو المستخدم غيّر paymentMethod بس من غير annualTarget —
 * ما يحسبش من صفر ويخزّن 0.
 *
 * @param notifyManagerId — لو موجود (حالة الـ agent)، بيُنشئ إشعار في Firestore
 */
export async function updateClient(
  id: string,
  data: Partial<Omit<Client, 'id' | 'createdAt'>>,
  options?: {
    notifyManagerId?: string;
    editorName?: string;
    clientName?: string;
    companyId?: string;
  }
): Promise<void> {
  // ✅ اجلب القيم الحالية من Firestore لو محتاجين نكمّل الحساب
  let currentData: Record<string, any> = {};
  if (
    (data.annualTarget !== undefined || data.paymentMethod !== undefined ||
     data.startMonth !== undefined) &&
    (data.annualTarget === undefined || data.paymentMethod === undefined || data.startMonth === undefined)
  ) {
    const snap = await getDoc(doc(db, COL, id));
    if (snap.exists()) currentData = snap.data();
  }

  let paymentAmount = data.paymentAmount;
  let lastCollectionMonth = data.lastCollectionMonth;

  if (data.annualTarget !== undefined || data.paymentMethod !== undefined) {
    const annualTarget  = data.annualTarget  ?? currentData.annualTarget  ?? 0;
    const paymentMethod = data.paymentMethod ?? currentData.paymentMethod ?? 'شهري';
    paymentAmount = calculatePaymentAmount(annualTarget, paymentMethod);
  }

  if (data.startMonth !== undefined || data.paymentMethod !== undefined) {
    const startMonth    = data.startMonth    ?? currentData.startMonth    ?? 'يناير';
    const paymentMethod = data.paymentMethod ?? currentData.paymentMethod ?? 'شهري';
    lastCollectionMonth = calculateLastCollectionMonth(startMonth, paymentMethod);
  }

  await updateDoc(doc(db, COL, id), {
    ...data,
    ...(paymentAmount      !== undefined ? { paymentAmount }      : {}),
    ...(lastCollectionMonth !== undefined ? { lastCollectionMonth } : {}),
    updatedAt: serverTimestamp(),
  });

  // ── إشعار تعديل العميل (خاص بالـ agent) ─────────────────────
  if (options?.notifyManagerId) {
    const changedFields = Object.keys(data).filter(
      (k) => !['paymentAmount', 'lastCollectionMonth', 'companyId'].includes(k)
    );
    if (changedFields.length > 0) {
      await addDoc(collection(db, 'notifications'), {
        type:        'client_edit',
        recipientId: options.notifyManagerId,
        companyId:   options.companyId ?? '',
        clientId:    id,
        clientName:  options.clientName ?? data.clientName ?? '',
        editorName:  options.editorName ?? '',
        changedFields,
        changes:     Object.fromEntries(
          changedFields.map((k) => [k, (data as any)[k]])
        ),
        read:      false,
        createdAt: serverTimestamp(),
      });
    }
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
