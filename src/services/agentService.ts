import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Agent } from '../types';

const COL = 'agents';

export async function getAgents(companyId: string, filters?: { group?: string }): Promise<Agent[]> {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
    orderBy('name', 'asc'),
  ];
  if (filters?.group) constraints.push(where('group', '==', filters.group));
  const q = query(collection(db, COL), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Agent));
}

export function subscribeToAgents(
  callback: (agents: Agent[]) => void,
  companyId: string,
  filters?: { group?: string }
): () => void {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
    orderBy('name', 'asc'),
  ];
  if (filters?.group) constraints.push(where('group', '==', filters.group));
  const q = query(collection(db, COL), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Agent)));
  });
}

export async function addAgent(data: Omit<Agent, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateAgent(id: string, data: Partial<Agent>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteAgent(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
