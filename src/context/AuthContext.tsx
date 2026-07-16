import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import {
  setUnauthorizedHandler,
  setTokenRefreshedHandler,
  ensureFreshToken,
} from '../api/client';
import { UserDto } from '../types';
import { getDeviceInfo } from '../utils/deviceInfo';
import { requestFCMPermission } from '../services/pushNotificationService';
import {
  updateNativeAuthToken,
  stopNativeTracking,
  clearGeofences,
} from '../services/nativeLocationTracking';

interface AuthContextType {
  user: UserDto | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEYS = ['auth_token', 'auth_user', 'refresh_token', 'auth_token_expires_at'];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLoggingOut = useRef(false);

  // clearSession: wipes local state only — safe to call from the 401 handler.
  // Also tears down location tracking: the native Android service is START_STICKY
  // with stopWithTask=false, so if we don't stop it here it keeps running (and
  // keeps POSTing pings with a dead token) long after the user has logged out.
  const clearSession = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    try {
      await stopNativeTracking();
      await clearGeofences();
      await updateNativeAuthToken(null);
      await AsyncStorage.multiRemove(AUTH_KEYS);
      setToken(null);
      setUser(null);
    } finally {
      isLoggingOut.current = false;
    }
  }, []);

  // logout: user-initiated — also revokes the refresh token server-side
  const logout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      await authApi.logout(refreshToken);
    } catch (_) {}
    await clearSession();
  }, [clearSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('auth_token');
        const savedUser = await AsyncStorage.getItem('auth_user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          // Roll the access token forward before anything can 401 on it, and hand
          // the fresh value to the native tracking service.
          const fresh = await ensureFreshToken();
          if (fresh) {
            setToken(fresh);
            await updateNativeAuthToken(fresh);
          }
          // Re-register FCM token on every app start (token can rotate)
          requestFCMPermission().catch(() => {});
        }
      } catch (_) {}
      setIsLoading(false);
    };
    bootstrap();

    // Only fires once a refresh attempt has actually failed — a bare 401 no longer
    // ejects the user (see api/client.ts).
    setUnauthorizedHandler(() => clearSession());

    // Keep the native tracking service's copy of the token in lockstep with ours.
    setTokenRefreshedHandler((newToken) => {
      setToken(newToken);
      updateNativeAuthToken(newToken).catch(() => {});
    });
  }, [clearSession]);

  // The app can sit backgrounded for days. Refresh on the way back in so the first
  // screen fetch — and the background pings — use a live token.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem('auth_token').then((existing) => {
        if (!existing) return;
        ensureFreshToken().catch(() => {});
      });
    });
    return () => sub.remove();
  }, []);

  const login = async (email: string, password: string) => {
    let deviceInfo;
    try {
      deviceInfo = await getDeviceInfo();
    } catch {
      deviceInfo = undefined;
    }
    const { data: res } = await authApi.login(email, password, deviceInfo);
    const { token, user, refreshToken, expiresAt } = res;

    const writes: [string, string][] = [
      ['auth_token', token],
      ['auth_user', JSON.stringify(user)],
    ];
    if (refreshToken) writes.push(['refresh_token', refreshToken]);
    if (expiresAt) writes.push(['auth_token_expires_at', String(expiresAt)]);
    await AsyncStorage.multiSet(writes);

    setToken(token);
    setUser(user);

    // A tracking service left over from a previous session still holds the old
    // token; overwrite it now so it doesn't 401 its way through the new session.
    await updateNativeAuthToken(token);

    // Register FCM device token with backend — same as web's handleLogin
    requestFCMPermission().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
