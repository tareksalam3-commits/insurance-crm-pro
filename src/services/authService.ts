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

export function subscribeToRegistrationRequests(
  callback: (requests: RegistrationRequest[]) => void,
  companyId?: string,
  managerId?: string,
): () => void {
  const constraints: any[] = [
    where('status', '==', 'pending'),
  ];
  if (companyId) constraints.push(where('companyId', '==', companyId));

  const q = query(collection(db, 'registrationRequests'), ...constraints, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRequest));
    if (managerId) {
      data = data.filter((r) => r.managerId === managerId);
    }
    callback(data);
  });
}

export async function approveRegistrationRequest(
  request: RegistrationRequest
): Promise<{ newUid: string }> {
  const tempPassword = `Tmp_${Math.random().toString(36).slice(2, 10)}!`;

  const newUid = await createUserWithSecondaryApp(
    request.email,
    tempPassword,
    request.displayName,
    request.requestedRole,
    request.companyId,
    request.managerId || undefined,
  );

  await addDoc(collection(db, 'agents'), {
    uid:            newUid,
    companyId:      request.companyId,
    name:           request.displayName,
    email:          request.email,
    group:          request.managerName || '',
    productionType: request.requestedRole,
    target:         DEFAULT_TARGETS[request.requestedRole] ?? 0,
    supervisorId:   request.managerId || '',
    managerName:    request.managerName || '',
    status:         'active',
    createdAt:      serverTimestamp(),
  });

  await updateDoc(doc(db, 'registrationRequests', request.id), {
    status:      'approved',
    approvedAt:  serverTimestamp(),
    approvedUid: newUid,
  });

  try {
    await sendPasswordResetEmail(auth, request.email, {
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: false,
    });
  } catch (emailError) {
    console.error('Email error:', emailError);
  }

  return { newUid };
}

export async function rejectRegistrationRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'registrationRequests', requestId), {
    status:     'rejected',
    rejectedAt: serverTimestamp(),
  });
}

// ─── Potential Managers (إصلاح نهائي مبسط) ─────────────────────────────────────

export async function getPotentialManagers(
  companyId: string,
  requestedRole: UserRole
): Promise<User[]> {
  try {
    // السلسلة الهرمية المسموح بها كمديرين
    const allowedRoles: Record<string, string[]> = {
      'agent': ['group_leader', 'supervisor', 'general_supervisor', 'sales_manager'],
      'group_leader': ['supervisor', 'general_supervisor', 'sales_manager'],
      'supervisor': ['general_supervisor', 'sales_manager'],
      'general_supervisor': ['sales_manager'],
      'sales_manager': [],
    };

    const targetRoles = allowedRoles[requestedRole] || [];
    
    // جلب جميع المستخدمين بالأدوار المسموح بها فقط
    const constraints: any[] = [
      where('companyId', '==', companyId),
      where('status', '==', 'active'),
    ];
    
    // إذا كانت هناك أدوار مسموح بها، أضفها للاستعلام
    if (targetRoles.length > 0) {
      constraints.push(where('role', 'in', targetRoles));
    }
    
    const q = query(collection(db, 'users'), ...constraints);
    const snap = await getDocs(q);
    const filtered = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User));

    return filtered.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ar'));
  } catch (err) {
    console.error('[getPotentialManagers] error:', err);
    return [];
  }
}
