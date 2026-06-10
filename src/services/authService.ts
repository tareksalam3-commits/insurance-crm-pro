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
  // ⚠️ حساب Firebase Auth لا يُحذف هنا — يتطلب Admin SDK
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

  // إشعار للمدير المباشر فقط
  if (data.managerId) {
    await addDoc(collection(db, 'notifications'), {
      type:          'registration_request',
      recipientId:   data.managerId,
      companyId:     data.companyId,
      requestId:     ref.id,
      applicantName: data.displayName,
      requestedRole: data.requestedRole,
      read:          false,
      createdAt:     serverTimestamp(),
    });
  } else {
    // لو مفيش مدير مباشر — إشعار لكل sales_manager في الشركة
    const managersSnap = await getDocs(query(
      collection(db, 'users'),
      where('companyId', '==', data.companyId),
      where('role', '==', 'sales_manager'),
    ));
    const notifPromises = managersSnap.docs.map((d) =>
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
    );
    await Promise.all(notifPromises);
  }

  return ref.id;
}

// FIX: تبسيط الكيري — نفلتر بـ companyId فقط على Firestore
// وبـ managerId على الكلاينت لتجنب الحاجة لـ composite index
export function subscribeToRegistrationRequests(
  callback: (requests: RegistrationRequest[]) => void,
  companyId?: string,
  managerId?: string,
): () => void {
  // كيري بسيط: status=pending + companyId فقط (index موجود بالفعل)
  const constraints: any[] = [
    where('status', '==', 'pending'),
  ];
  if (companyId) constraints.push(where('companyId', '==', companyId));

  const q = query(collection(db, 'registrationRequests'), ...constraints, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRequest));
    // فلترة managerId على الكلاينت (بدل Firestore) لتجنب composite index
    if (managerId) {
      data = data.filter((r) => r.managerId === managerId);
    }
    callback(data);
  });
}

/**
 * الموافقة على طلب التسجيل:
 * 1. ينشئ حساب Firebase Auth بكلمة مرور مؤقتة عشوائية (لا تُحفظ)
 * 2. يضيف doc في users بـ status: 'active'
 * 3. يضيف record في agents
 * 4. يحدّث حالة الطلب إلى approved
 * 5. يبعت إيميل reset password — المستخدم يضغط اللينك ويحط كلمة سر جديدة
 *
 * يمكن أن يوافق: super_admin، sales_manager، general_supervisor، supervisor
 */
export async function approveRegistrationRequest(
  request: RegistrationRequest
): Promise<{ newUid: string }> {
  // كلمة مرور مؤقتة عشوائية — لا تُحفظ في أي مكان
  const tempPassword = `Tmp_${Math.random().toString(36).slice(2, 10)}!`;

  const newUid = await createUserWithSecondaryApp(
    request.email,
    tempPassword,
    request.displayName,
    request.requestedRole,
    request.companyId,
    request.managerId || undefined,
  );

  // إضافة في agents إذا كان الدور وكيل (أو أي دور إنتاجي آخر)
  // ملاحظة: يتم إضافة السجل لجميع الأدوار لضمان ظهورهم في التقارير والإنتاج
  await addDoc(collection(db, 'agents'), {
    uid:            newUid,
    companyId:      request.companyId,
    name:           request.displayName,
    email:          request.email,
    group:          request.managerName || '',  // اسم المجموعة
    productionType: request.requestedRole,
    target:         DEFAULT_TARGETS[request.requestedRole] ?? 0,
    supervisorId:   request.managerId || '',    // UID المدير المباشر
    managerName:    request.managerName || '',  // اسم المدير المباشر
    status:         'active',
    createdAt:      serverTimestamp(),
  });

  // تحديث حالة الطلب
  await updateDoc(doc(db, 'registrationRequests', request.id), {
    status:      'approved',
    approvedAt:  serverTimestamp(),
    approvedUid: newUid,
  });

  // إرسال إيميل reset password من Firebase مباشرة
  // اللينك يوجه المستخدم على صفحة /reset-password في التطبيق
  try {
    await sendPasswordResetEmail(auth, request.email, {
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: false,
    });
  } catch (emailError) {
    // تسجيل التحذير لكن لا نوقف العملية
    // يمكن للمستخدم استخدام نسيت كلمة المرور لاحقاً
  }

  return { newUid };
}

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
