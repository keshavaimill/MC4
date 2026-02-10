// ── Mills ──
export const mills = [
  { id: "A", name: "Mill A", location: "Jeddah", availableDays: 84, capacityHoursPerWeek: 120 },
  { id: "B", name: "Mill B", location: "Riyadh", availableDays: 84, capacityHoursPerWeek: 100 },
  { id: "C", name: "Mill C", location: "Dammam", availableDays: 78, capacityHoursPerWeek: 90 },
];

// ── Flour Types ──
export const flourTypes = ["10kg", "25kg", "50kg", "Bulk", "Wholesale"] as const;
export type FlourType = (typeof flourTypes)[number];

// ── Recipes ──
export const recipes = [
  { id: "80S", name: "80 Straight", hoursPerRun: 480, costPerTon: 320, wasteRate: 0.032, color: "#D85B2B" },
  { id: "8070", name: "80/70 Blend", hoursPerRun: 360, costPerTon: 295, wasteRate: 0.028, color: "#F2A85C" },
  { id: "7260", name: "72/60 Blend", hoursPerRun: 300, costPerTon: 340, wasteRate: 0.041, color: "#8B9B7E" },
  { id: "SB", name: "Special Blend", hoursPerRun: 240, costPerTon: 380, wasteRate: 0.022, color: "#8B4513" },
];

// ── Recipe Eligibility Matrix ──
export const eligibility: Record<string, Record<FlourType, boolean>> = {
  "80S": { "10kg": true, "25kg": true, "50kg": true, Bulk: true, Wholesale: true },
  "8070": { "10kg": true, "25kg": true, "50kg": true, Bulk: false, Wholesale: true },
  "7260": { "10kg": false, "25kg": true, "50kg": true, Bulk: true, Wholesale: false },
  SB: { "10kg": true, "25kg": false, "50kg": true, Bulk: false, Wholesale: true },
};

// ── Capacity Heatmap Data (3 mills × 12 weeks) ──
function genUtilization(): number {
  const r = Math.random();
  if (r < 0.3) return 60 + Math.random() * 20;
  if (r < 0.7) return 80 + Math.random() * 15;
  return 95 + Math.random() * 8;
}

export const capacityHeatmap = mills.map((m) => ({
  mill: m.id,
  weeks: Array.from({ length: 12 }, (_, i) => ({
    week: i + 1,
    utilization: Math.round(genUtilization()),
  })),
}));

// ── SKU Forecast ──
const regions = ["Central", "Western", "Eastern", "Southern", "Northern"];
const packSizes = ["1kg", "2kg", "5kg", "10kg", "25kg", "50kg"];

export const skuForecast = Array.from({ length: 50 }, (_, i) => ({
  id: `SKU-${String(i + 1).padStart(3, "0")}`,
  name: `${flourTypes[i % flourTypes.length]} Flour ${packSizes[i % packSizes.length]}`,
  packSize: packSizes[i % packSizes.length],
  region: regions[i % regions.length],
  monthlyForecast: Math.round(100 + Math.random() * 900),
  confidence: Math.round(55 + Math.random() * 45),
  seasonalityIndex: +(0.7 + Math.random() * 0.6).toFixed(2),
}));

// ── Wheat Origins ──
export const wheatOrigins = [
  { country: "Canada", lat: 56, lng: -106, volume: 35, costIndex: 0.85, riskScore: 12, yieldFactor: 0.94 },
  { country: "Australia", lat: -25, lng: 134, volume: 25, costIndex: 0.92, riskScore: 18, yieldFactor: 0.91 },
  { country: "USA", lat: 38, lng: -97, volume: 20, costIndex: 0.88, riskScore: 10, yieldFactor: 0.96 },
  { country: "Argentina", lat: -34, lng: -64, volume: 12, costIndex: 0.78, riskScore: 25, yieldFactor: 0.88 },
  { country: "France", lat: 46, lng: 2, volume: 8, costIndex: 1.05, riskScore: 8, yieldFactor: 0.93 },
];

// ── Executive KPIs ──
export const executiveKpis = [
  { label: "Total Demand", value: "12,480", unit: "tons", delta: 5.2, driver: "Western region +12%" },
  { label: "Recipe Time Util.", value: "87.3", unit: "%", delta: -2.1, driver: "Mill C maintenance" },
  { label: "Capacity Violations", value: "3", unit: "mills", delta: 1, driver: "Week 8-10 surge" },
  { label: "Avg Cost/Ton", value: "SAR 328", unit: "", delta: -3.4, driver: "Wheat price drop" },
  { label: "Waste Rate", value: "3.1", unit: "%", delta: -0.4, driver: "72/60 optimization" },
  { label: "Vision 2030 Score", value: "78", unit: "/100", delta: 6, driver: "Sustainability gains" },
];

// ── Recipe Hours Demand (for hero chart) ──
export const recipeHoursDemand = [
  { recipe: "80 Straight", millA: 520, millB: 380, millC: 290 },
  { recipe: "80/70 Blend", millA: 310, millB: 420, millC: 180 },
  { recipe: "72/60 Blend", millA: 280, millB: 190, millC: 350 },
  { recipe: "Special Blend", millA: 150, millB: 210, millC: 120 },
];

// ── Gantt Schedule ──
export const ganttSchedule = [
  { mill: "A", recipe: "80 Straight", startDay: 1, endDay: 5, color: "#D85B2B" },
  { mill: "A", recipe: "80/70 Blend", startDay: 6, endDay: 9, color: "#F2A85C" },
  { mill: "A", recipe: "Special Blend", startDay: 10, endDay: 12, color: "#8B4513" },
  { mill: "B", recipe: "72/60 Blend", startDay: 1, endDay: 4, color: "#8B9B7E" },
  { mill: "B", recipe: "80 Straight", startDay: 5, endDay: 10, color: "#D85B2B" },
  { mill: "B", recipe: "80/70 Blend", startDay: 11, endDay: 14, color: "#F2A85C" },
  { mill: "C", recipe: "80/70 Blend", startDay: 1, endDay: 6, color: "#F2A85C" },
  { mill: "C", recipe: "72/60 Blend", startDay: 7, endDay: 11, color: "#8B9B7E" },
  { mill: "C", recipe: "80 Straight", startDay: 12, endDay: 14, color: "#D85B2B" },
];

// ── Waste Data ──
export const wasteByRecipeMill = mills.map((m) => ({
  mill: m.id,
  recipes: recipes.map((r) => ({
    recipe: r.name,
    wastePercent: +(r.wasteRate * 100 + (Math.random() - 0.5) * 1.5).toFixed(1),
  })),
}));

export const wasteTrend = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  actual: +(3.8 - i * 0.06 + (Math.random() - 0.5) * 0.3).toFixed(1),
  target: +(3.5 - i * 0.08).toFixed(1),
}));

// ── Scenarios ──
export const scenarios = [
  {
    name: "Base",
    totalDemand: 12480,
    utilization: 87.3,
    violations: 3,
    costPerTon: 328,
    wasteRate: 3.1,
    millOverload: { A: 40, B: 0, C: 65 },
  },
  {
    name: "Ramadan Surge",
    totalDemand: 15200,
    utilization: 96.1,
    violations: 7,
    costPerTon: 345,
    wasteRate: 3.8,
    millOverload: { A: 120, B: 85, C: 140 },
  },
  {
    name: "Summer Low",
    totalDemand: 9800,
    utilization: 68.4,
    violations: 0,
    costPerTon: 310,
    wasteRate: 2.6,
    millOverload: { A: 0, B: 0, C: 0 },
  },
];

// ── Alerts ──
export const alerts = [
  {
    id: 1,
    title: "Mill C Overload — Week 8",
    severity: "critical" as const,
    cause: "Ramadan demand surge exceeds Mill C capacity by 140 hours",
    impact: 140,
    confidence: 92,
    action: "Redistribute 60 hrs to Mill A",
    timestamp: "2026-02-10T08:30:00",
  },
  {
    id: 2,
    title: "Wheat Supply Delay — Argentina",
    severity: "warning" as const,
    cause: "Port congestion delaying 12% of wheat supply by 2 weeks",
    impact: 85,
    confidence: 78,
    action: "Switch to Canadian substitute",
    timestamp: "2026-02-09T14:15:00",
  },
  {
    id: 3,
    title: "72/60 Waste Above Target",
    severity: "warning" as const,
    cause: "Batch inconsistency increasing waste to 4.1% (target: 3.5%)",
    impact: 45,
    confidence: 85,
    action: "Review milling parameters",
    timestamp: "2026-02-09T11:00:00",
  },
  {
    id: 4,
    title: "Vision 2030 Score Improved",
    severity: "info" as const,
    cause: "Sustainability metrics improved by 6 pts this quarter",
    impact: 0,
    confidence: 95,
    action: "Report to stakeholders",
    timestamp: "2026-02-08T16:45:00",
  },
  {
    id: 5,
    title: "Mill A Maintenance Window",
    severity: "info" as const,
    cause: "Scheduled maintenance Week 10 — 24hr downtime",
    impact: 24,
    confidence: 100,
    action: "Shift production to Week 9",
    timestamp: "2026-02-08T09:00:00",
  },
  {
    id: 6,
    title: "Recipe Cost Spike — Special Blend",
    severity: "critical" as const,
    cause: "Premium wheat cost increase +18% impacts Special Blend margin",
    impact: 110,
    confidence: 88,
    action: "Negotiate bulk pricing",
    timestamp: "2026-02-07T13:20:00",
  },
];

// ── Translation Funnel ──
export const translationFunnel = [
  { stage: "SKU Forecast", value: 12480, conversionPct: 100 },
  { stage: "Flour Demand", value: 11230, conversionPct: 90 },
  { stage: "Recipe Allocation", value: 10100, conversionPct: 81 },
  { stage: "Mill Schedule", value: 9590, conversionPct: 77 },
];
