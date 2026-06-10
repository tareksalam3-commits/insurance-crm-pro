import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, writeBatch,
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
    agentId:             data.agentId            ?? '',
    group:               data.group              ?? '',
    agentName:           data.agentName          ?? '',
    supervisorId:        data.supervisorId       ?? '',  // uid المراقب — للفلترة
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
  filters?: { agentName?: string; agentId?: string; group?: string; supervisorId?: string }
): () => void {
  // لا نستخدم orderBy مع where لتجنب الحاجة لـ Composite Index
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
  ];
  if (filters?.agentId)        constraints.push(where('agentId', '==', filters.agentId));
  else if (filters?.agentName) constraints.push(where('agentName', '==', filters.agentName));
  if (filters?.supervisorId)   constraints.push(where('supervisorId', '==', filters.supervisorId));
  if (filters?.group)          constraints.push(where('group', '==', filters.group));

  const q = query(collection(db, COL), ...constraints);
  return onSnapshot(q, (snap) => {
    const clients = snap.docs.map((d) => normalizeClient(d.id, d.data()));
    // ترتيب على الكلاينت بدل Firestore
    clients.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    callback(clients);
  });
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getClients(
  companyId: string,
  filters?: { agentName?: string; agentId?: string; group?: string }
): Promise<Client[]> {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
  ];
  if (filters?.agentId)        constraints.push(where('agentId', '==', filters.agentId));
  else if (filters?.agentName) constraints.push(where('agentName', '==', filters.agentName));
  if (filters?.group)          constraints.push(where('group', '==', filters.group));

  const q = query(collection(db, COL), ...constraints);
  const snap = await getDocs(q);
  const clients = snap.docs.map((d) => normalizeClient(d.id, d.data()));
  clients.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return clients;
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
 * تحديث بيانات العميل.
 *
 * FIX #8: الحساب الآن يعتمد على القيم الفعلية الموجودة في data
 * (وليس ?? 0 أو ?? 'شهري' التي تُفسد الحساب عند تعديل حقل واحد فقط).
 * المستدعي مسؤول عن إرسال القيم الكاملة عند الحاجة للإعادة الحساب.
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
  const updateData: Record<string, any> = { ...data, updatedAt: serverTimestamp() };

  // FIX #8: نعيد الحساب فقط إذا القيمتان المطلوبتان موجودتان فعلاً في data
  if (data.annualTarget !== undefined && data.paymentMethod !== undefined) {
    updateData.paymentAmount = calculatePaymentAmount(data.annualTarget, data.paymentMethod);
  }
  if (data.startMonth !== undefined && data.paymentMethod !== undefined) {
    updateData.lastCollectionMonth = calculateLastCollectionMonth(data.startMonth, data.paymentMethod);
  }

  await updateDoc(doc(db, COL, id), updateData);

  // إشعار المدير (خاص بالـ agent)
  if (options?.notifyManagerId) {
    const changedFields = Object.keys(data).filter(
      (k) => !['paymentAmount', 'lastCollectionMonth'].includes(k)
    );

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
      read:        false,
      createdAt:   serverTimestamp(),
    });
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * FIX #7: حذف العميل + كل سجلات التحصيل المرتبطة به في batch واحد
 * لمنع بيانات يتيمة تُلوّث الإحصائيات.
 */
export async function deleteClient(id: string): Promise<void> {
  const batch = writeBatch(db);

  // حذف العميل نفسه
  batch.delete(doc(db, COL, id));

  // حذف سجلات التحصيل المرتبطة
  const recordsSnap = await getDocs(
    query(collection(db, 'paymentRecords'), where('clientId', '==', id))
  );
  recordsSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
}
