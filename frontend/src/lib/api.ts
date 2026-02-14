/**
 * Thin API helper – all backend calls go through here.
 * Uses the Vite dev-server proxy (/api → http://localhost:8008).
 */

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string] => e[1] !== undefined && e[1] !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function get<T = unknown>(
  path: string,
  params: Record<string, string | undefined> = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(`${url}${qs(params)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── KPI endpoints ──────────────────────────────────────────────────────
export interface ExecutiveKpis {
  demand: { total_tons: number; growth_pct: number };
  recipe_time: { total_hours: number; utilization_pct: number };
  capacity: { utilization_pct: number; overload_mills: number };
  risk: { avg_wheat_price: number; price_change_pct: number };
  waste: { waste_rate_pct: number; delta_pct: number };
  vision2030: { score: number; delta: number };
}

export const fetchExecutiveKpis = (p: Record<string, string | undefined>) =>
  get<ExecutiveKpis>("/api/kpis/executive", p);

export interface DemandRecipeKpis {
  total_sku_forecast_units: number;
  bulk_flour_required_tons: number;
  total_recipe_hours: number;
  forecast_confidence_pct: number;
  seasonality_index: number;
}

export const fetchDemandRecipeKpis = (p: Record<string, string | undefined>) =>
  get<DemandRecipeKpis>("/api/kpis/demand-recipe", p);

export interface RecipePlanningKpis {
  planned_recipe_hours: number;
  available_mill_hours: number;
  slack_shortfall_hours: number;
  avg_changeovers: number;
  wheat_cost_index: number;
  waste_impact_pct: number;
  cost_impact_pct: number;
  risk_score: number;
}

export const fetchRecipePlanningKpis = (p: Record<string, string | undefined>) =>
  get<RecipePlanningKpis>("/api/kpis/recipe-planning", p);

export interface MillOperationsKpis {
  mill_utilization_pct: number;
  overload_hours: number;
  recipe_switch_count: number;
  avg_run_length_days: number;
  downtime_risk_score: number;
}

export const fetchMillOperationsKpis = (p: Record<string, string | undefined>) =>
  get<MillOperationsKpis>("/api/kpis/mill-operations", p);

export interface RawMaterialsKpis {
  total_wheat_requirement_tons: number;
  avg_wheat_cost_sar: number;
  import_dependency_pct: number;
  high_risk_supply_pct: number;
  yield_variability_index: number;
}

export const fetchRawMaterialsKpis = (p: Record<string, string | undefined>) =>
  get<RawMaterialsKpis>("/api/kpis/raw-materials", p);

export interface SustainabilityKpis {
  waste_rate_pct: number;
  waste_target_pct: number;
  waste_gap: number;
  energy_per_ton: number;
  water_per_ton: number;
  vision_2030_score: number;
}

export const fetchSustainabilityKpis = (p: Record<string, string | undefined>) =>
  get<SustainabilityKpis>("/api/kpis/sustainability", p);

// ─── Data endpoints ─────────────────────────────────────────────────────
export const fetchSkuForecast = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/forecast/sku", p);

export const fetchBulkFlour = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/demand/bulk-flour", p);

export const fetchRecipePlanning = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/planning/recipe", p);

export const fetchRecipeEligibility = () =>
  get<{ data: Record<string, unknown>[] }>("/api/planning/recipe-eligibility");

export const fetchMillCapacity = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/capacity/mill", p);

export const fetchMillSchedule = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/capacity/mill-schedule", p);

export const fetchRawMaterial = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/raw-material", p);

export const fetchWheatRequirement = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/wheat-requirement", p);

export const fetchWasteMetrics = (p: Record<string, string | undefined>) =>
  get<{ data: Record<string, unknown>[] }>("/api/waste-metrics", p);

export const fetchAlerts = (p: Record<string, string | undefined>) =>
  get<{ alerts: Record<string, unknown>[] }>("/api/alerts", p);

// ─── Reports ────────────────────────────────────────────────────────────
export const fetchReportData = (
  reportId: string,
  p: Record<string, string | undefined>
) => get<{ data: Record<string, unknown>[] }>(`/api/reports/${reportId}`, p);

export const downloadReportCsv = async (
  reportId: string,
  p: Record<string, string | undefined>
) => {
  const res = await fetch(
    `/api/reports/${reportId}/download${qs(p)}`
  );
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reportId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const emailReport = (
  reportId: string,
  p: Record<string, string | undefined>
) => post<{ success: boolean; message: string }>(`/api/reports/${reportId}/email`, p);

// ─── Chatbot ────────────────────────────────────────────────────────────
export interface ChatbotResponse {
  answer?: string;
  sql_query?: string;
  data?: Record<string, unknown>[];
  chart?: string; // base64 image
  error?: string;
}

export const chatbotQuery = (question: string) =>
  post<ChatbotResponse>("/api/chatbot/query", { question });

export const emailChatbotInsight = (insight: {
  question: string;
  answer: string;
  sql_query?: string;
  data?: Record<string, unknown>[];
  chart?: string;
}) => post<{ success: boolean; message: string }>("/api/chatbot/email", insight);
