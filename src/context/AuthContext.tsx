import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { UserDto } from '../types';
import { getDeviceInfo } from '../utils/deviceInfo';
import { requestFCMPermission } from '../services/pushNotificationService';

interface AuthContextType {
  user: UserDto | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLoggingOut = useRef(false);

  // clearSession: wipes local state only — safe to call from 401 handler
  const clearSession = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
    setToken(null);
    setUser(null);
    isLoggingOut.current = false;
  }, []);

  // logout: user-initiated — also tells the server
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
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
          // Re-register FCM token on every app start (token can rotate)
          requestFCMPermission().catch(() => {});
        }
      } catch (_) {}
      setIsLoading(false);
    };
    bootstrap();
    // 401 handler skips server call — token is already invalid
    setUnauthorizedHandler(() => clearSession());
  }, [clearSession]);

  const login = async (email: string, password: string) => {
    let deviceInfo;
    try {
      deviceInfo = await getDeviceInfo();
    } catch {
      deviceInfo = undefined;
    }
    const { data: res } = await authApi.login(email, password, deviceInfo);
    const { token, user } = res;
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    setToken(token);
    setUser(user);
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
