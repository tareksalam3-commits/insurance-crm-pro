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

// التارجت الافتراضي لكل وظيفة
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
    ? [where('companyId', '==', companyId)]
    : [];
  const q = query(collection(db, 'users'), ...constraints);
  return onSnapshot(q, (snap) => {
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User));
    users.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '', 'ar'));
    callback(users);
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

/**
 * إرسال طلب انضمام جديد.
 * الوكيل يختار الشركة فقط — المراقب العام يعيّن المراقب ورئيس المجموعة عند الموافقة.
 * كلمة المرور تُخزَّن مشفرة مؤقتاً في Firestore وتُحذف فور إنشاء الحساب.
 * ملاحظة: في بيئة الإنتاج استبدل التخزين المؤقت بـ Cloud Function.
 */
export async function submitRegistrationRequest(
  data: {
    displayName: string;
    email: string;
    phone?: string;
    password: string;         // كلمة السر التي أدخلها المستخدم
    companyId: string;
    companyName: string;
    requestedRole: UserRole;
  }
): Promise<string> {
  // نخزن كلمة السر مؤقتاً — ستُحذف فور الموافقة
  const ref = await addDoc(collection(db, 'registrationRequests'), {
    displayName:   data.displayName,
    email:         data.email,
    phone:         data.phone ?? '',
    _pwd:          data.password,   // مؤقت — يُحذف عند approveRegistrationRequest
    companyId:     data.companyId,
    companyName:   data.companyName,
    requestedRole: data.requestedRole,
    managerId:     '',
    managerName:   '',
    status:        'pending',
    createdAt:     serverTimestamp(),
  });

  // إشعار لكل المراقبين العاميين في الشركة
  const gsSnap = await getDocs(query(
    collection(db, 'users'),
    where('companyId', '==', data.companyId),
    where('role', '==', 'general_supervisor'),
  ));
  // + إشعار لمدير المبيعات كذلك
  const smSnap = await getDocs(query(
    collection(db, 'users'),
    where('companyId', '==', data.companyId),
    where('role', '==', 'sales_manager'),
  ));

  const recipients = [...gsSnap.docs, ...smSnap.docs];
  await Promise.all(recipients.map((d) =>
    addDoc(collection(db, 'notifications'), {
      type:          'registration_request',
      recipientId:   d.id,
      companyId:     data.companyId,
      requestId:     ref.id,
      applicantName: data.displayName,
      requestedRole: data.requestedRole,
      read:          false,
      createdAt:     serverTimestamp(),
    })
  ));

  return ref.id;
}

export function subscribeToRegistrationRequests(
  callback: (requests: RegistrationRequest[]) => void,
  companyId?: string,
  managerId?: string,
): () => void {
  const constraints: any[] = [where('status', '==', 'pending')];
  if (companyId) constraints.push(where('companyId', '==', companyId));

  const q = query(collection(db, 'registrationRequests'), ...constraints);

  return onSnapshot(q, (snap) => {
    let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRequest));
    if (managerId) {
      data = data.filter((r) => r.managerId === managerId);
    }
    callback(data);
  });
}

/**
 * الموافقة على طلب التسجيل من قِبَل المراقب العام:
 * 1. يستخدم كلمة السر المخزّنة مؤقتاً لإنشاء الحساب
 * 2. يحذف _pwd فوراً من Firestore
 * 3. يُضيف doc في users + agents
 * 4. يُحدّث حالة الطلب → approved
 *
 * المراقب العام يعيّن: المراقب (supervisorId) ورئيس المجموعة (groupLeaderId) قبل الموافقة.
 */
export async function approveRegistrationRequest(
  request: RegistrationRequest,
  assignData?: {
    supervisorId?: string;
    supervisorName?: string;
    groupLeaderId?: string;
    groupLeaderName?: string;
  }
): Promise<{ newUid: string }> {
  // نجيب كلمة السر المؤقتة
  const reqSnap = await getDoc(doc(db, 'registrationRequests', request.id));
  const pwd: string = (reqSnap.data() as any)?._pwd ?? `Tmp_${Math.random().toString(36).slice(2, 10)}!`;

  const managerId   = assignData?.supervisorId   || assignData?.groupLeaderId   || '';
  const managerName = assignData?.supervisorName || assignData?.groupLeaderName || '';

  const newUid = await createUserWithSecondaryApp(
    request.email,
    pwd,
    request.displayName,
    request.requestedRole,
    request.companyId,
    managerId || undefined,
  );

  // إضافة في agents
  await addDoc(collection(db, 'agents'), {
    uid:            newUid,
    companyId:      request.companyId,
    name:           request.displayName,
    email:          request.email,
    phone:          request.phone ?? '',
    group:          managerName,
    productionType: request.requestedRole,
    target:         DEFAULT_TARGETS[request.requestedRole] ?? 0,
    supervisorId:   managerId,
    managerName:    managerName,
    status:         'active',
    createdAt:      serverTimestamp(),
  });

  // تحديث حالة الطلب + حذف كلمة السر المؤقتة
  await updateDoc(doc(db, 'registrationRequests', request.id), {
    status:           'approved',
    approvedAt:       serverTimestamp(),
    approvedUid:      newUid,
    managerId:        managerId,
    managerName:      managerName,
    supervisorId:     assignData?.supervisorId   ?? '',
    supervisorName:   assignData?.supervisorName ?? '',
    groupLeaderId:    assignData?.groupLeaderId  ?? '',
    groupLeaderName:  assignData?.groupLeaderName ?? '',
    _pwd:             null,   // حذف كلمة السر فوراً
  });

  return { newUid };
}

export async function rejectRegistrationRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'registrationRequests', requestId), {
    status:     'rejected',
    rejectedAt: serverTimestamp(),
    _pwd:       null,
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

// جلب مستخدمين بدور محدد في شركة
export async function getUsersByRole(companyId: string, role: UserRole): Promise<User[]> {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    where('role', '==', role),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as User))
    .filter((u) => u.status === 'active');
}
