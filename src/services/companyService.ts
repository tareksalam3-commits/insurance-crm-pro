import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Company } from '../types';

const COL = 'companies';

export async function getCompanies(): Promise<Company[]> {
  const q = query(collection(db, COL), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company));
}

export function subscribeToCompanies(callback: (companies: Company[]) => void): () => void {
  const q = query(collection(db, COL), orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company)));
  });
}

export async function addCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateCompany(id: string, data: Partial<Company>): Promise<void> {
  await updateDoc(doc(db, COL, id), data);
}

export async function deleteCompany(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function getCompany(id: string): Promise<Company | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Company;
}
