import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
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
import { sendWelcomeEmail } from './emailService';

// التارجت الافتراضي لكل وظيفة حسب اللائحة
const DEFAULT_TARGETS: Partial<Record<UserRole, number>> = {
  agent:              12150,
  group_leader:       60000,
  supervisor:         120000,
  general_supervisor: 240000,
  sales_manager:      750000,
};

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

// FIX #2: deleteUserProfile تحذف الـ Firestore doc فقط.
// حذف حساب Firebase Auth يتطلب Admin SDK (Cloud Function).
// تم وضع تعليق واضح لمنع الخطأ من الاكتشاف لاحقاً.
export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
  // ⚠️ تنبيه: حساب Firebase Auth لا يُحذف هنا.
  // لحذف الحساب بالكامل، أضف Cloud Function تستدعي admin.auth().deleteUser(uid)
  // وابعت إليها uid بعد حذف الـ doc.
}

// ─── Registration Requests ────────────────────────────────────────────────────

// FIX #1: submitRegistrationRequest لا تحفظ كلمة المرور نهائياً.
// المستخدم يضبط كلمة المرور بنفسه بعد الموافقة عبر رابط إعادة تعيين.
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
  if (companyId) constraints.push(where('companyId', '==', companyId));
  const q = query(collection(db, 'registrationRequests'), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRequest)));
  });
}

/**
 * الموافقة على طلب تسجيل:
 * 1. ينشئ حساب Firebase Auth بكلمة مرور مؤقتة
 * 2. يرسل إيميل إعادة تعيين كلمة المرور للمستخدم
 * 3. يضيف doc في users
 * 4. يضيف record في agents تلقائياً
 * 5. يحدّث حالة الطلب إلى approved
 *
 * FIX #1: كلمة المرور المؤقتة عشوائية ولا تُحفظ في Firestore.
 */
export async function approveRegistrationRequest(
  request: RegistrationRequest
): Promise<void> {
  // كلمة مرور مؤقتة عشوائية — المستخدم سيغيّرها عبر إيميل إعادة التعيين
  const tempPassword = `Tmp_${Math.random().toString(36).slice(2, 10)}!`;

  const newUid = await createUserWithSecondaryApp(
    request.email,
    tempPassword,
    request.displayName,
    request.requestedRole,
    request.companyId,
    request.managerId || undefined,
  );

  // إضافة في agents تلقائياً
  await addDoc(collection(db, 'agents'), {
    companyId:      request.companyId,
    name:           request.displayName,
    group:          '',
    productionType: request.requestedRole,
    target:         DEFAULT_TARGETS[request.requestedRole] ?? 0,
    supervisorId:   request.managerId || '',
    status:         'active',
    createdAt:      serverTimestamp(),
  });

  // تحديث حالة الطلب
  await updateDoc(doc(db, 'registrationRequests', request.id), {
    status:      'approved',
    approvedAt:  serverTimestamp(),
    approvedUid: newUid,
  });

  // إرسال إيميل إعادة تعيين كلمة المرور مع تحديد الـ URL الصح
  const appUrl = window.location.origin;
  await sendPasswordResetEmail(auth, request.email, {
    url: `${appUrl}/reset-password`,
    handleCodeInApp: true,
  });

  // إرسال إيميل الترحيب المخصص عبر EmailJS
  try {
    await sendWelcomeEmail(
      request.displayName,
      request.email,
      `${appUrl}/reset-password`,
    );
  } catch (emailErr) {
    // لو EmailJS فشل، الـ Firebase reset email اتبعت فعلاً — مش مشكلة حرجة
    console.warn('EmailJS failed (Firebase reset email was sent):', emailErr);
  }
}

// FIX #5: rejectRegistrationRequest تغيّر الحالة إلى rejected بدل الحذف
// حتى يبقى سجل بالطلبات المرفوضة ويعلم المستخدم بالرفض
export async function rejectRegistrationRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'registrationRequests', requestId), {
    status:     'rejected',
    rejectedAt: serverTimestamp(),
  });
}

// ─── Potential Managers ───────────────────────────────────────────────────────

export async function getPotentialManagers(
  companyId: string,
  requestedRole: UserRole
): Promise<User[]> {
  const managerRole: UserRole | undefined = MANAGER_ROLE_FOR[requestedRole];
  if (!managerRole) return [];

  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    where('role', '==', managerRole),
  );
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as User))
    .filter((u) => u.status === 'active');
}
