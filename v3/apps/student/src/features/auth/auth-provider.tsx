import { ApiError } from '@vibe/api';
import {
  getAdditionalUserInfo,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '@/lib/api';
import { auth, googleProvider } from '@/lib/firebase';
import { queryClient } from '@/lib/query-client';

import { describeAuthError } from './auth-errors';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface SignUpInput {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signInWithGoogle: () => Promise<{ isNewUser: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Splits a full name into the backend's firstName/lastName fields. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [status, setStatus] = useState<AuthStatus>(auth.currentUser ? 'signed-in' : 'loading');

  useEffect(
    () =>
      onIdTokenChanged(auth, (next) => {
        setUser(next);
        setStatus(next ? 'signed-in' : 'signed-out');
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw new Error(describeAuthError(error));
    }
  }, []);

  /**
   * Same sequence as the current app: the backend creates the Firebase account
   * and the ViBe user record (POST /auth/signup), then we sign in with Firebase.
   */
  const signUp = useCallback(async ({ firstName, lastName, email, password }: SignUpInput) => {
    const result = await api.POST('/api/auth/signup', {
      body: { email, password, firstName, lastName: lastName || undefined, recaptchaToken: 'NO_CAPTCHA' },
    });
    if (result.error || !result.response.ok) {
      const body = result.error as { message?: string; errors?: { constraints?: Record<string, string> }[] } | undefined;
      const details = body?.errors?.flatMap((e) => Object.values(e.constraints ?? {})).join('. ');
      throw new Error(details || body?.message || 'Could not create your account. Please try again.');
    }
    await signIn(email, password);
  }, [signIn]);

  /** Google sign-in; first-time users are registered with the backend afterwards. */
  const signInWithGoogle = useCallback(async () => {
    let credential;
    try {
      credential = await signInWithPopup(auth, googleProvider);
    } catch (error) {
      throw new Error(describeAuthError(error));
    }
    const isNewUser = getAdditionalUserInfo(credential)?.isNewUser ?? false;
    if (isNewUser) {
      const { firstName, lastName } = splitName(credential.user.displayName ?? '');
      const result = await api.POST('/api/auth/signup/google', {
        body: {
          email: credential.user.email ?? '',
          firstName: firstName || (credential.user.email ?? 'Student').split('@')[0],
          lastName: lastName || undefined,
        },
      });
      if (result.error || !result.response.ok) {
        throw new ApiError(result.response.status, 'Signed in with Google, but we could not finish setting up your account.', result.error);
      }
    }
    return { isNewUser };
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/login` });
    } catch (error) {
      throw new Error(describeAuthError(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    queryClient.clear();
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signInWithGoogle, sendPasswordReset, signOut }),
    [status, user, signIn, signUp, signInWithGoogle, sendPasswordReset, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Resolves once Firebase has restored (or ruled out) a session — used by route guards. */
export function authReady(): Promise<User | null> {
  return auth.authStateReady().then(() => auth.currentUser);
}
