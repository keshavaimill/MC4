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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber/30 via-background to-secondary">
      {/* Subtle wheat pattern overlay */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D85B2B' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card/95 p-10 shadow-2xl backdrop-blur">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <img
              src="/MC4_Logo.webp"
              alt="MC4 logo"
              className="h-12 w-12 rounded-md object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MC4 Planning Platform</h1>
          <p className="text-sm text-muted-foreground">Sign in with your MC4 account</p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
            className="mt-2 w-full"
            disabled={loading || submitting}
          >
            {loading || submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="grid gap-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            Role-based access
          </p>
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
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-accent/30 px-3 py-2 text-left transition-colors hover:bg-accent/60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <role.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">{role.title}</div>
                <div className="text-[11px] text-muted-foreground">{role.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
