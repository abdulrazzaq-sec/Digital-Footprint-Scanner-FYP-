import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SESSION_KEY = "dfs_session";
const USER_KEY = "dfs_user";
const SCAN_KEY = "dfs_scans";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  emailVerified?: boolean;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

interface ScanResult {
  type: string;
  timestamp: string;
  data: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  logout: () => Promise<void>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  setSessionFromCallback: (accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>;
  scanResults: Record<string, ScanResult>;
  saveScanResult: (scanType: string, data: any) => void;
  getScanResult: (scanType: string) => ScanResult | null;
  clearScanResults: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function persistSession(s: Session, u: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}

function wipeSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  });
  const [session, setSession] = useState<Session | null>(loadSession);
  const [isLoading, setIsLoading] = useState(true);
  const [scanResults, setScanResults] = useState<Record<string, ScanResult>>(() => {
    try { return JSON.parse(localStorage.getItem(SCAN_KEY) || "{}"); } catch { return {}; }
  });

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySession = useCallback((s: Session, u: User) => {
    setSession(s);
    setUser(u);
    persistSession(s, u);
  }, []);

  const clearAll = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    wipeSession();
    setSession(null);
    setUser(null);
  }, []);

  const performRefresh = useCallback(async (refreshToken: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      applySession(
        { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: Date.now() + data.expiresIn * 1000 },
        data.user
      );
      return true;
    } catch {
      clearAll();
      return false;
    }
  }, [applySession, clearAll]);

  const scheduleRefresh = useCallback((s: Session) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const msLeft = s.expiresAt - Date.now();
    const delay = Math.max(msLeft - 5 * 60 * 1000, 60 * 1000); // refresh 5 min before expiry
    refreshTimer.current = setTimeout(() => performRefresh(s.refreshToken), delay);
  }, [performRefresh]);

  // Bootstrap on mount
  useEffect(() => {
    const stored = loadSession();
    if (!stored) { setIsLoading(false); return; }

    if (Date.now() > stored.expiresAt) {
      performRefresh(stored.refreshToken).finally(() => setIsLoading(false));
    } else {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored.accessToken}` } })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const u: User = await r.json();
          applySession(stored, u);
          scheduleRefresh(stored);
        })
        .catch(() => performRefresh(stored.refreshToken))
        .finally(() => setIsLoading(false));
    }

    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session) scheduleRefresh(session);
  }, [session, scheduleRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error, code: data.code };
    applySession(
      { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: Date.now() + data.expiresIn * 1000 },
      data.user
    );
    return { success: true };
  }, [applySession]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, needsVerification: true };
  }, []);

  const logout = useCallback(async () => {
    const token = session?.accessToken;
    clearAll();
    try {
      if (token) {
        await fetch(`${API}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch { /* best-effort */ }
  }, [session, clearAll]);

  const resendVerification = useCallback(async (email: string) => {
    const res = await fetch(`${API}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.status === 429) return { success: false, error: data.error };
    return res.ok ? { success: true } : { success: false, error: data.error };
  }, []);

  const setSessionFromCallback = useCallback(async (accessToken: string, refreshToken: string, expiresIn: number) => {
    const s: Session = { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
    const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error("Could not fetch user profile after verification");
    const u: User = await res.json();
    applySession(s, u);
  }, [applySession]);

  const saveScanResult = useCallback((scanType: string, data: any) => {
    setScanResults((prev) => {
      const next = { ...prev, [scanType]: { type: scanType, timestamp: new Date().toISOString(), data } };
      localStorage.setItem(SCAN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getScanResult = useCallback((scanType: string): ScanResult | null => {
    return scanResults[scanType] ?? null;
  }, [scanResults]);

  const clearScanResults = useCallback(() => {
    setScanResults({});
    localStorage.removeItem(SCAN_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && !!session,
      isLoading,
      accessToken: session?.accessToken ?? null,
      login,
      signup,
      logout,
      resendVerification,
      setSessionFromCallback,
      scanResults,
      saveScanResult,
      getScanResult,
      clearScanResults,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
