import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Agent } from '../types';

const COL = 'agents';

function normalizeAgent(id: string, data: Record<string, any>): Agent {
  return {
    id,
    uid:           data.uid           ?? id,   // fallback للـ id لو uid مش موجود
    companyId:     data.companyId     ?? '',
    name:          data.name          ?? '',
    email:         data.email,
    group:         data.group         ?? '',
    productionType: data.productionType ?? 'agent',
    target:        data.target        ?? 0,
    supervisorId:  data.supervisorId  ?? '',
    managerName:   data.managerName   ?? '',
    status:        data.status        ?? 'active',
    createdAt:     data.createdAt,
  };
}

export async function getAgents(companyId: string, filters?: { group?: string }): Promise<Agent[]> {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
  ];
  if (filters?.group) constraints.push(where('group', '==', filters.group));
  const q = query(collection(db, COL), ...constraints);
  const snap = await getDocs(q);
  const agents = snap.docs.map((d) => normalizeAgent(d.id, d.data()));
  return agents.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export function subscribeToAgents(
  callback: (agents: Agent[]) => void,
  companyId: string,
  filters?: { group?: string }
): () => void {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', companyId),
  ];
  if (filters?.group) constraints.push(where('group', '==', filters.group));
  const q = query(collection(db, COL), ...constraints);
  return onSnapshot(q, (snap) => {
    const agents = snap.docs.map((d) => normalizeAgent(d.id, d.data()));
    callback(agents.sort((a, b) => a.name.localeCompare(b.name, 'ar')));
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
