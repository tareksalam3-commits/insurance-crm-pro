import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  type User as FirebaseUser,
  getAuth,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, orderBy,
  serverTimestamp, addDoc, getDocs,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, firebaseConfig } from '../firebase/config';
import type { User, UserRole, RegistrationRequest } from '../types';

// ─── Sign In / Out ────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── Get User Profile ─────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as User;
}

// ─── Subscribe to Users ───────────────────────────────────────────────────────

export function subscribeToUsers(
  callback: (users: User[]) => void,
  companyId?: string
): () => void {
  const constraints = companyId
    ? [where('companyId', '==', companyId), orderBy('displayName', 'asc')]
    : [orderBy('displayName', 'asc')];

  const q = query(collection(db, 'users'), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
  });
}

// ─── Create User via Secondary App ───────────────────────────────────────────

export async function createUserWithSecondaryApp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  companyId: string,
  managerId?: string,
): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await updateProfile(cred.user, { displayName });

    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      companyId,
      ...(managerId ? { managerId } : {}),
      status: 'active',
      createdAt: serverTimestamp(),
    });

    return cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

// ─── Update User ──────────────────────────────────────────────────────────────

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<User, 'displayName' | 'role' | 'status' | 'managerId' | 'groupId'>>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}

// ─── Registration Requests ────────────────────────────────────────────────────

export async function submitRegistrationRequest(
  data: Omit<RegistrationRequest, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'registrationRequests'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeToRegistrationRequests(
  callback: (requests: RegistrationRequest[]) => void,
  companyId?: string
): () => void {
  const constraints: any[] = [
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  ];
  if (companyId) {
    constraints.push(where('companyId', '==', companyId));
  }
  const q = query(collection(db, 'registrationRequests'), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRequest)));
  });
}

export async function approveRegistrationRequest(
  request: RegistrationRequest
): Promise<void> {
  await createUserWithSecondaryApp(
    request.email,
    request.password ?? 'TempPass123!',
    request.displayName,
    request.requestedRole,
    request.companyId,
    request.managerId,
  );

  await updateDoc(doc(db, 'registrationRequests', request.id), {
    status: 'approved',
    approvedAt: serverTimestamp(),
  });
}

export async function rejectRegistrationRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'registrationRequests', requestId));
}

// ─── Get Potential Managers ───────────────────────────────────────────────────

export async function getPotentialManagers(
  companyId: string,
  requestedRole: UserRole
): Promise<User[]> {
  let managerRole: UserRole | null = null;
  switch (requestedRole) {
    case 'general_supervisor': managerRole = 'sales_manager'; break;
    case 'supervisor':         managerRole = 'general_supervisor'; break;
    case 'group_leader':       managerRole = 'supervisor'; break;
    case 'agent':              managerRole = 'group_leader'; break;
    default: return [];
  }

  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    where('role', '==', managerRole),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User));
}
