export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export type UserRole = 'user' | 'community_admin' | 'superadmin';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  role?: UserRole;
  status?: 'active' | 'banned' | 'suspended';
  plan?: 'free' | 'pro' | 'community';
}

export interface AuthContextValue {
  currentUser: AuthUser | null;
  authState: AuthState;
  isGuest: boolean;
  signIn(email: string, password?: string): Promise<void>;
  signUp(email: string, password?: string, displayName?: string): Promise<void>;
  signOut(): Promise<void>;
}
