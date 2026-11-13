'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  testFirestoreConnection,
} from '@/lib/firebase';
import {
  FIELD_LIMITS,
  UNLIMITED_ADMIN_EXPIRY_MS,
  UserProfile,
  emailToKey,
  isAdminEmail,
} from '@/lib/prompts-seed';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  hasActiveAccess: boolean;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  const checkPreapprovedPurchase = useCallback(async (email: string) => {
    const key = emailToKey(email);
    const approvalPath = `approved_purchases/${key}`;
    try {
      const snap = await getDoc(doc(db, 'approved_purchases', key));
      if (!snap.exists()) return null;
      const data = snap.data();
      if (
        data.planStatus === 'active' &&
        typeof data.email === 'string' &&
        data.email.toLowerCase() === email.toLowerCase()
      ) {
        const days =
          typeof data.durationDays === 'number' && data.durationDays > 0
            ? Math.min(90, data.durationDays)
            : 90;
        return { durationDays: days };
      }
      return null;
    } catch (err) {
      console.warn(`Pre-approval lookup skipped for ${approvalPath}:`, err);
      return null;
    }
  }, []);

  const syncServerCaktoApproval = useCallback(async (firebaseUser: User) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      await fetch('/api/cakto/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
    } catch {
      // Non-blocking fallback
    }
  }, []);

  const loadOrCreateProfile = useCallback(
    async (firebaseUser: User) => {
      const userPath = `users/${firebaseUser.uid}`;
      const userRef = doc(db, 'users', firebaseUser.uid);

      try {
        const now = Date.now();
        setClockMs(now);
        const adminUser = Boolean(
          firebaseUser.emailVerified && isAdminEmail(firebaseUser.email)
        );
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const raw = snap.data();
          const currentExpiry = toDate(raw.accessExpiresAt);
          let currentStatus = raw.planStatus as UserProfile['planStatus'];

          // Admins always have unlimited active access (never capped at 90 days)
          if (adminUser) {
            if (
              currentStatus !== 'active' ||
              currentExpiry.getTime() < UNLIMITED_ADMIN_EXPIRY_MS - 86400000
            ) {
              await updateDoc(userRef, {
                planStatus: 'active',
                accessExpiresAt: Timestamp.fromMillis(UNLIMITED_ADMIN_EXPIRY_MS),
                updatedAt: serverTimestamp(),
              });
            }
            setProfile({
              uid: raw.uid,
              email: raw.email,
              displayName: raw.displayName,
              planStatus: 'active',
              accessExpiresAt: new Date(UNLIMITED_ADMIN_EXPIRY_MS),
              createdAt: raw.createdAt ? toDate(raw.createdAt) : undefined,
              updatedAt: new Date(now),
            });
            return;
          }

          const needsActivation =
            currentStatus !== 'active' || currentExpiry.getTime() <= now;

          // If pending or expired, verify Cakto server records & pre-approved purchases
          if (
            needsActivation &&
            firebaseUser.email &&
            firebaseUser.emailVerified
          ) {
            await syncServerCaktoApproval(firebaseUser);
            const refreshedSnap = await getDoc(userRef);
            const refreshedRaw = refreshedSnap.exists()
              ? refreshedSnap.data()
              : raw;
            const refreshedExpiry = toDate(refreshedRaw.accessExpiresAt);
            if (
              refreshedRaw.planStatus === 'active' &&
              refreshedExpiry.getTime() > now
            ) {
              setProfile({
                uid: refreshedRaw.uid,
                email: refreshedRaw.email,
                displayName: refreshedRaw.displayName,
                planStatus: 'active',
                accessExpiresAt: refreshedExpiry,
                createdAt: refreshedRaw.createdAt
                  ? toDate(refreshedRaw.createdAt)
                  : undefined,
                updatedAt: refreshedRaw.updatedAt
                  ? toDate(refreshedRaw.updatedAt)
                  : undefined,
              });
              return;
            }

            const approved = await checkPreapprovedPurchase(firebaseUser.email);
            if (approved) {
              const nextExpiryMs = now + approved.durationDays * 86400000;
              await updateDoc(userRef, {
                planStatus: 'active',
                accessExpiresAt: Timestamp.fromMillis(nextExpiryMs),
                updatedAt: serverTimestamp(),
              });
              setProfile({
                uid: raw.uid,
                email: raw.email,
                displayName: raw.displayName,
                planStatus: 'active',
                accessExpiresAt: new Date(nextExpiryMs),
                createdAt: raw.createdAt ? toDate(raw.createdAt) : undefined,
                updatedAt: new Date(now),
              });
              return;
            }
          }

          if (currentStatus === 'active' && currentExpiry.getTime() <= now) {
            currentStatus = 'expired';
          }

          setProfile({
            uid: raw.uid,
            email: raw.email,
            displayName: raw.displayName,
            planStatus: currentStatus,
            accessExpiresAt: currentExpiry,
            createdAt: raw.createdAt ? toDate(raw.createdAt) : undefined,
            updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : undefined,
          });
          return;
        }

        let initialStatus: UserProfile['planStatus'] = 'pending';
        let expiryMs = now - 60000;

        if (adminUser) {
          initialStatus = 'active';
          expiryMs = UNLIMITED_ADMIN_EXPIRY_MS;
        } else if (firebaseUser.email && firebaseUser.emailVerified) {
          await syncServerCaktoApproval(firebaseUser);
          const approved = await checkPreapprovedPurchase(firebaseUser.email);
          if (approved) {
            initialStatus = 'active';
            expiryMs = now + approved.durationDays * 86400000;
          }
        }

        const safeName = (
          firebaseUser.displayName ||
          firebaseUser.email?.split('@')[0] ||
          'Membro'
        ).slice(0, FIELD_LIMITS.DISPLAY_NAME_MAX);

        const newProfilePayload = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || 'usuario@exemplo.com',
          displayName: safeName,
          planStatus: initialStatus,
          accessExpiresAt: Timestamp.fromMillis(expiryMs),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(userRef, newProfilePayload);
        setProfile({
          uid: newProfilePayload.uid,
          email: newProfilePayload.email,
          displayName: newProfilePayload.displayName,
          planStatus: initialStatus,
          accessExpiresAt: new Date(expiryMs),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }
    },
    [checkPreapprovedPurchase, syncServerCaktoApproval]
  );

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError(null);
      if (nextUser) {
        try {
          await loadOrCreateProfile(nextUser);
        } catch (err) {
          setAuthError(
            err instanceof Error
              ? 'Não foi possível carregar seu perfil no banco de dados.'
              : 'Erro de autenticação.'
          );
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [loadOrCreateProfile]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir o login com Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Falha ao entrar com Google. Tente novamente.');
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!user) return;
      const cleanName = name.trim().slice(0, FIELD_LIMITS.DISPLAY_NAME_MAX);
      if (!cleanName) return;

      const userPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: cleanName,
          updatedAt: serverTimestamp(),
        });
        setProfile((prev) =>
          prev ? { ...prev, displayName: cleanName } : prev
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadOrCreateProfile(user);
  }, [user, loadOrCreateProfile]);

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const isAdmin = useMemo(() => {
    return Boolean(user?.emailVerified && isAdminEmail(user.email));
  }, [user]);

  const hasActiveAccess = useMemo(() => {
    if (isAdmin) return true;
    if (!profile) return false;
    return (
      profile.planStatus === 'active' &&
      profile.accessExpiresAt.getTime() > clockMs
    );
  }, [isAdmin, profile, clockMs]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAdmin,
      hasActiveAccess,
      loading,
      signingIn,
      authError,
      signInWithGoogle,
      logout,
      updateDisplayName,
      refreshProfile,
      getIdToken,
    }),
    [
      user,
      profile,
      isAdmin,
      hasActiveAccess,
      loading,
      signingIn,
      authError,
      signInWithGoogle,
      logout,
      updateDisplayName,
      refreshProfile,
      getIdToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return ctx;
}
