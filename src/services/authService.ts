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
import { MANAGER_ROLE_FOR } from '../hooks/usePermissions';

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as User;
}

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

// ─── Create User (Secondary App) ──────────────────────────────────────────────

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

// ─── Update / Delete User ─────────────────────────────────────────────────────

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

/**
 * الاشتراك في طلبات التسجيل المعلقة.
 * - super_admin: يشوف كل الطلبات (بدون companyId filter)
 * - sales_manager: يشوف طلبات شركته فقط (companyId مطلوب)
 */
export function subscribeToRegistrationRequests(
  callback: (requests: RegistrationRequest[]) => void,
  companyId?: string   // undefined = super_admin يجيب الكل
): () => void {
  const constraints: any[] = [
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  ];

  // sales_manager يفلتر بشركته بس
  if (companyId) {
    constraints.push(where('companyId', '==', companyId));
  }

  const q = query(collection(db, 'registrationRequests'), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRequest)));
  });
}

/**
 * الموافقة على طلب تسجيل:
 * - ينشئ حساب Firebase Auth
 * - يضيف doc في users
 * - يحدّث حالة الطلب إلى approved
 */
export async function approveRegistrationRequest(
  request: RegistrationRequest
): Promise<void> {
  await createUserWithSecondaryApp(
    request.email,
    request.password ?? 'TempPass123!',
    request.displayName,
    request.requestedRole,
    request.companyId,
    request.managerId || undefined,
  );
  await updateDoc(doc(db, 'registrationRequests', request.id), {
    status: 'approved',
    approvedAt: serverTimestamp(),
  });
}

/**
 * رفض طلب التسجيل — يحذف الطلب نهائياً
 */
export async function rejectRegistrationRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'registrationRequests', requestId));
}

// ─── Potential Managers ───────────────────────────────────────────────────────

/**
 * يجيب المديرين المحتملين للوظيفة المطلوبة في نفس الشركة.
 * بيستخدم MANAGER_ROLE_FOR من usePermissions لضمان التوافق مع التسلسل الهرمي.
 */
export async function getPotentialManagers(
  companyId: string,
  requestedRole: UserRole
): Promise<User[]> {
  const managerRole: UserRole | undefined = MANAGER_ROLE_FOR[requestedRole];

  // sales_manager ليس له مدير داخل النظام (يتبع super_admin مباشرة)
  if (!managerRole) return [];

  // جيب users وفلتر يدوياً (لتجنب Composite Index)
  const snap = await getDocs(query(collection(db, 'users')));

  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as User))
    .filter(
      (u) =>
        u.companyId === companyId &&
        u.role === managerRole &&
        u.status === 'active'
    );
}
