import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Client, ProductionType } from '../types';
import { calculatePaymentAmount, calculateLastCollectionMonth } from './paymentService';

const COL = 'clients';

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

export async function getClients(companyId: string, filters?: { agentName?: string; group?: string }): Promise<Client[]> {
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

export async function updateClient(id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<void> {
  let paymentAmount = data.paymentAmount;
  let lastCollectionMonth = data.lastCollectionMonth;

  if (data.annualTarget !== undefined || data.paymentMethod !== undefined) {
    paymentAmount = calculatePaymentAmount(data.annualTarget ?? 0, data.paymentMethod ?? 'شهري');
  }
  if (data.startMonth !== undefined || data.paymentMethod !== undefined) {
    lastCollectionMonth = calculateLastCollectionMonth(data.startMonth ?? 'يناير', data.paymentMethod ?? 'شهري');
  }

  await updateDoc(doc(db, COL, id), { ...data, paymentAmount, lastCollectionMonth, updatedAt: serverTimestamp() });
}

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
