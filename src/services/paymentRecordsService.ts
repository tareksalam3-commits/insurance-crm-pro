import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { PaymentRecord } from '../types';

const COL = 'paymentRecords';

export async function addPaymentRecord(data: Omit<PaymentRecord, 'id' | 'collectedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, collectedAt: serverTimestamp() });
  return ref.id;
}

export async function deletePaymentRecord(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function getPaymentRecords(
  companyId: string,
  filters?: { clientId?: string; agentName?: string; month?: string; year?: number }
): Promise<PaymentRecord[]> {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
  ];
  if (filters?.clientId)  constraints.push(where('clientId', '==', filters.clientId));
  if (filters?.agentName) constraints.push(where('agentName', '==', filters.agentName));
  if (filters?.month)     constraints.push(where('month', '==', filters.month));
  if (filters?.year)      constraints.push(where('year', '==', filters.year));

  const q = query(collection(db, COL), ...constraints);
  const snap = await getDocs(q);
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
  records.sort((a, b) => {
    const ta = (a.collectedAt as any)?.toMillis?.() ?? 0;
    const tb = (b.collectedAt as any)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return records;
}

export function subscribeToPaymentRecords(
  callback: (records: PaymentRecord[]) => void,
  companyId: string,
  filters?: { month?: string; year?: number; agentName?: string }
): () => void {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
  ];
  if (filters?.month)     constraints.push(where('month', '==', filters.month));
  if (filters?.year)      constraints.push(where('year', '==', filters.year));
  if (filters?.agentName) constraints.push(where('agentName', '==', filters.agentName));

  const q = query(collection(db, COL), ...constraints);
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
    records.sort((a, b) => {
      const ta = (a.collectedAt as any)?.toMillis?.() ?? 0;
      const tb = (b.collectedAt as any)?.toMillis?.() ?? 0;
      return tb - ta;
    });
    callback(records);
  });
}

export async function checkPaymentExists(clientId: string, month: string, year: number): Promise<boolean> {
  const q = query(
    collection(db, COL),
    where('clientId', '==', clientId),
    where('month', '==', month),
    where('year', '==', year)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
