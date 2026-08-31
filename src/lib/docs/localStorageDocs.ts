// Automatic synchronization of Pitch Deck and Product Manual into Local Storage

export const PITCH_DECK_STORAGE_KEY = "wellness-pitch-deck-data";
export const PRODUCT_MANUAL_STORAGE_KEY = "wellness-product-manual-data";

export const PITCH_DECK_DATA = {
  title: "AI Wellness Twin — Pitch Deck",
  version: "1.0 MVP",
  tagline: "Proactive Burnout Prevention Powered by Passive Workday Telemetry & Adaptive Baseline Calibration",
  liveAppUrl: "https://ai-wellness-twin.vercel.app",
  repository: "https://github.com/ronnielmharlssb-dot/ai-wellness-twin",
  slides: [
    {
      slide: 1,
      title: "Title & Hook",
      headline: "AI Wellness Twin: The Intelligent Digital Twin for Workplace Wellbeing",
      bullets: [
        "Proactive Burnout Prevention Powered by Passive Workday Telemetry & Adaptive Baseline Calibration",
        "2-4 Week Predictive Burnout Horizon",
        "Strict k-Anonymity (k >= 3) Privacy Guarantee"
      ]
    },
    {
      slide: 2,
      title: "The Problem",
      headline: "The $322 Billion Silent Workplace Burnout Crisis",
      bullets: [
        "76% of knowledge workers suffer from acute burnout quarterly",
        "21.5 hours weekly spent in fragmented meetings with zero deep-work focus",
        "Quarterly HR surveys are retrospective, slow, and distrusted by employees"
      ]
    },
    {
      slide: 3,
      title: "The Solution",
      headline: "A Continuous, Calibrated Digital Twin",
      bullets: [
        "Passive telemetry aggregation across 9 productivity tools",
        "28-Day self-referential baseline calibration (no peer rankings)",
        "'What-If' parameter simulation predicting recovery trajectories in real-time",
        "Strict k-Anonymity (k >= 3) for HR aggregate team radar"
      ]
    },
    {
      slide: 4,
      title: "Data Ingestion Engine",
      headline: "9 Supported Workday Integrations via Zero-Content Metadata Firewall",
      tools: ["GitHub", "VS Code", "ChatGPT", "Google Gemini", "Claude", "Google Calendar", "Figma", "Slack", "Discord"],
      guarantee: "Strict zero-keystroke, prompt text, code, or meeting title logging"
    },
    {
      slide: 5,
      title: "User Experience",
      headline: "Dual-Portal Role Architecture",
      employeePortal: "Health Twin Score (0-100), Burnout Radar, What-If Simulator, MBI-GS Assessment, Personal Reports",
      hrPortal: "Workforce Overview Radar, Team k >= 3 Privacy Lock Shield, Single-Use Token Invites, Macro Trends"
    },
    {
      slide: 6,
      title: "Market Opportunity",
      headline: "A Massive $61B+ Global Opportunity",
      tam: "$61.2B Global Corporate Wellness Market by 2027",
      sam: "$23.8B B2B Tech & Remote Workforce Retention Software",
      som: "$3.2B High-growth software engineering & design enterprises"
    },
    {
      slide: 7,
      title: "Business Model",
      headline: "Tiered B2B SaaS Subscriptions",
      tiers: [
        { name: "Starter", price: "$6/seat/mo", target: "Startups (10-50 seats)" },
        { name: "Growth / Pro", price: "$12/seat/mo", target: "Mid-market (50-500 seats) [Most Popular]" },
        { name: "Enterprise", price: "$18/seat/mo", target: "500+ seats (Custom webhooks, SSO, Dedicated AI)" }
      ]
    },
    {
      slide: 8,
      title: "Competitive Advantage",
      headline: "Why AI Wellness Twin Wins",
      advantages: [
        "Passive telemetry + validated active surveys",
        "2-4 week predictive window vs post-hoc surveys",
        "Zero surveillance: strict k >= 3 anonymity and non-comparative baselines"
      ]
    },
    {
      slide: 9,
      title: "Roadmap",
      headline: "From MVP to Enterprise Scale",
      phases: [
        "Phase 1: Production MVP (Completed Q3 2026)",
        "Phase 2: Wearable Biometrics Sync (Apple Watch/Oura/Whoop) + Auto Calendar Buffers (Q4 2026)",
        "Phase 3: Autonomous Enterprise Workload Rebalancing (2027+)"
      ]
    },
    {
      slide: 10,
      title: "The Ask & Next Steps",
      headline: "Seeking Pilot Enterprise Partners & Pre-Seed Investment",
      contact: "ronnie@company.com | team@wellness-twin.ai",
      testAccounts: {
        employee: "ronnie@company.com / password123",
        hr: "hr@company.com / password123"
      }
    }
  ]
};

export const PRODUCT_MANUAL_DATA = {
  title: "AI Wellness Twin — Product & Operations Manual",
  version: "1.0 MVP",
  lastUpdated: "August 2026",
  summary: "Comprehensive system manual covering dual-portal architecture, 9 integrations, k-anonymity privacy safeguards, and operational guides.",
  testAccounts: [
    { role: "Employee", email: "ronnie@company.com", pass: "password123", portal: "/dashboard" },
    { role: "HR Admin", email: "hr@company.com", pass: "password123", portal: "/hr" }
  ]
};

export function syncDocsToLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PITCH_DECK_STORAGE_KEY, JSON.stringify(PITCH_DECK_DATA));
    localStorage.setItem(PRODUCT_MANUAL_STORAGE_KEY, JSON.stringify(PRODUCT_MANUAL_DATA));
  } catch {
    // ignore quota/storage errors
  }
}
