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
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-gray-50 px-4 py-10 sm:py-16 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-4 sm:mb-6 flex justify-center">
          <div className="h-14 sm:h-16 w-14 sm:w-16 rounded-2xl border border-border/70 bg-white/80 flex items-center justify-center shadow-card overflow-hidden">
            <img src="/MC4_Logo.webp" alt="MC4 logo" className="h-10 sm:h-12 w-10 sm:w-12 object-contain" loading="lazy" />
          </div>
        </div>
        <div className="mb-6 sm:mb-8 text-center space-y-2">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-muted-foreground">MC4</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Operations Command Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="section-shell border-border/70 bg-white/90 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Work email
              </label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@mc4.sa"
              className="text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="text-sm"
            />
          </div>
            <Button
              type="submit"
              className="w-full rounded-xl bg-foreground text-primary-foreground hover:opacity-90 font-semibold"
              disabled={loading || submitting}
            >
              {loading || submitting ? "Signing in…" : "Login"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Role-based access</p>
            <div className="grid gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    const creds = roleCredentials[role.id];
                    if (creds) {
                      setEmail(creds.email);
                      setPassword(creds.password);
                    }
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-white/70 px-3 py-2.5 text-left transition-all hover:bg-muted/50 hover:border-primary/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <role.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">{role.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{role.description}</div>
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
