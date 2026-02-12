import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Cog, TrendingUp, ClipboardList, Factory } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const roles = [
  { id: "ceo", title: "CEO", icon: Crown, description: "Executive overview, strategic KPIs" },
  { id: "coo", title: "COO", icon: Cog, description: "Operations & capacity management" },
  { id: "sales", title: "Sales", icon: TrendingUp, description: "Demand forecasting & SKU planning" },
  { id: "planning", title: "Planning", icon: ClipboardList, description: "Recipe allocation & scheduling" },
  { id: "operations", title: "Operations", icon: Factory, description: "Mill runtime & sequencing" },
];

const roleLandingRoute: Record<string, string> = {
  ceo: "/dashboard",
  coo: "/dashboard",
  sales: "/demand",
  planning: "/planning",
  operations: "/operations",
};

const roleCredentials: Record<string, { email: string; password: string }> = {
  ceo: { email: "ceo@mc4.sa", password: "ceo123" },
  coo: { email: "coo@mc4.sa", password: "coo123" },
  sales: { email: "sales@mc4.sa", password: "sales123" },
  planning: { email: "planning@mc4.sa", password: "plan123" },
  operations: { email: "operations@mc4.sa", password: "ops123" },
};

export default function Login() {
  const navigate = useNavigate();
  const { user, login, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      const route = roleLandingRoute[user.role] ?? "/dashboard";
      navigate(route, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (!result.success || !result.role) {
      toast({
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const route = roleLandingRoute[result.role] ?? "/dashboard";
    navigate(route, { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-background px-4 py-10 sm:py-16 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-5 flex justify-center">
          <div className="h-14 w-14 rounded-xl border border-border bg-card flex items-center justify-center shadow-card overflow-hidden">
            <img src="/MC4_Logo.webp" alt="MC4 logo" className="h-10 w-10 object-contain" loading="lazy" />
          </div>
        </div>

        {/* Header */}
        <div className="mb-7 text-center space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">MC4</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Operations Command Center</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-5">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Work email
              </label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mc4.sa"
                className="text-sm h-10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                className="text-sm h-10"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-semibold text-sm"
              disabled={loading || submitting}
            >
              {loading || submitting ? "Signing in\u2026" : "Sign in"}
            </Button>
          </form>

          {/* Role shortcuts */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 font-medium">Quick access</p>
            <div className="grid gap-1.5">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    const creds = roleCredentials[role.id];
                    if (creds) { setEmail(creds.email); setPassword(creds.password); }
                  }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-accent/50 hover:border-primary/20"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-foreground">
                    <role.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">{role.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{role.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
