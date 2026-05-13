import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ─── Password ─────────────────────────────────────────────────────────────────
// Change this to whatever you want. A more robust approach would be an env var
// served from the API, but for a single-user internal tool this is fine.
const APP_PASSWORD = "Clinic@2027";
const STORAGE_KEY = "clinic_os_auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const login = useCallback((password: string): boolean => {
    if (password === APP_PASSWORD) {
      setIsAuthenticated(true);
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

