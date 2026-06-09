import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { onAuthChange } from '../services/authService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';
import { getPermissions, type Permissions } from './usePermissions';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  permissions: Permissions;
}

const defaultPermissions = getPermissions('agent');

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  user: null,
  loading: true,
  permissions: defaultPermissions,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthChange((fbUser) => {
      setFirebaseUser(fbUser);
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }

      if (fbUser) {
        unsubProfile = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
          if (snap.exists()) {
            setUser({ uid: snap.id, ...snap.data() } as User);
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // حساب الصلاحيات تلقائياً عند تغيير الدور
  const permissions = useMemo(
    () => (user ? getPermissions(user.role) : defaultPermissions),
    [user?.role]
  );

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, permissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
