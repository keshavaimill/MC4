import { createContext, useContext, useEffect, useState } from "react";

type UserRole = "ceo" | "coo" | "sales" | "planning" | "operations";

export interface AuthUser {
  email: string;
  role: UserRole;
}

interface LoginResult {
  success: boolean;
  role?: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "mc4-auth-user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const res = await fetch("/users.csv", { cache: "no-store" });
      if (!res.ok) {
        console.error("Failed to load users.csv");
        return { success: false };
      }
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return { success: false };

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const emailIdx = headers.indexOf("email");
      const passwordIdx = headers.indexOf("password");
      const roleIdx = headers.indexOf("role");

      if (emailIdx === -1 || passwordIdx === -1 || roleIdx === -1) {
        console.error("users.csv missing required columns");
        return { success: false };
      }

      const normalizedEmail = email.trim().toLowerCase();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(",").map((c) => c.trim());
        const csvEmail = cols[emailIdx].toLowerCase();
        const csvPassword = cols[passwordIdx];
        const csvRole = cols[roleIdx] as UserRole;

        if (csvEmail === normalizedEmail && csvPassword === password) {
          const authUser: AuthUser = { email: csvEmail, role: csvRole };
          setUser(authUser);
          return { success: true, role: csvRole };
        }
      }

      return { success: false };
    } catch (err) {
      console.error("Error during CSV auth", err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

