# AI Wellness Twin — Product & Operations Manual
**Version 1.0 MVP (Production Ready)**  
*Confidential — For Evaluators, HR Leaders & Technical Teams*

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Core Concept](#2-product-vision--core-concept)
3. [System Architecture & Data Flows](#3-system-architecture--data-flows)
4. [Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
5. [Employee Experience Portal Walkthrough (`/dashboard`)](#5-employee-experience-portal-walkthrough-dashboard)
6. [HR Workforce Administration Portal (`/hr`)](#6-hr-workforce-administration-portal-hr)
7. [Telemetry Integrations & Data Ingestion Engine](#7-telemetry-integrations--data-ingestion-engine)
8. [Privacy Architecture & $k$-Anonymity Guarantees](#8-privacy-architecture--k-anonymity-guarantees)
9. [Deployment & Configuration Runbook](#9-deployment--configuration-runbook)
10. [Test Accounts & Verification Guide](#10-test-accounts--verification-guide)

---

## 1. Executive Summary

Modern knowledge workers face chronic burnout driven by back-to-back video conferences, fragmented focus blocks, after-hours messaging, and unspoken cognitive overload. Traditional corporate wellness initiatives fail because they rely on reactive, post-burnout surveys that employees distrust.

**AI Wellness Twin** is an intelligent, privacy-first digital twin platform that models individual work-life rhythms and provides real-time proactive interventions before burnout occurs. 

### Key Highlights:
- **Bi-Directional Telemetry**: Combines passive background signals (calendar density, GitHub commits, IDE focus, messaging timestamps) with active subjective reflections (MBI-GS Maslach Burnout Inventory).
- **Personalized Calibrated Baseline**: Every employee is evaluated exclusively against their own 28-day historical baseline—never ranked against peers.
- **Strict $k$-Anonymity ($k \ge 3$)**: HR leadership views aggregated trends only when at least 3 team members belong to a group. Individual raw logs and prompt contents are strictly firewalled.
- **"What-If" Digital Twin Simulator**: Allows workers to simulate the impact of boundary adjustments (e.g., reducing meeting load by 25% or establishing 2-hour focus blocks) on their predicted burnout recovery score.

---

## 2. Product Vision & Core Concept

```
   ┌─────────────────────────────────────────────────────────────┐
   │                    AI WELLNESS TWIN ENGINE                  │
   └─────────────────────────────────────────────────────────────┘
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       ▼                                                     ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│       PASSIVE SIGNALS        │              │        ACTIVE SIGNALS        │
│ • IDE Focus Sessions         │              │ • Daily Pulse Check-ins      │
│ • Calendar Meeting Density   │              │ • MBI-GS Burnout Surveys     │
│ • GitHub Commit Timestamps   │              │ • Energy & Sleep Logs        │
│ • After-Hours Chat Windows   │              │ • Stress Self-Assessments    │
└──────────────────────────────┘              └──────────────────────────────┘
       │                                                     │
       └──────────────────────────┬──────────────────────────┘
                                  ▼
                ┌──────────────────────────────────┐
                │   PERSONAL 28-DAY CALIBRATION    │
                │     Adaptive Baseline Modeling   │
                └──────────────────────────────────┘
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       ▼                                                     ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│      EMPLOYEE DASHBOARD      │              │      HR AGGREGATE RADAR      │
│ (Private & Non-Comparative)  │              │ (Strict k >= 3 Anonymity)    │
│ • Real-time Health Twin Score│              │ • Department Workload Radar  │
│ • Pattern Shift Diagnostics  │              │ • Organizational Macro Trends│
│ • "What-If" Twin Simulator   │              │ • Single-Use Token Invites   │
│ • Micro-Habit Recommendations│              │ • Overtime Hazard Warning    │
└──────────────────────────────┘              └──────────────────────────────┘
```

---

## 3. System Architecture & Data Flows

### Frontend & Application Layer
- **Framework**: Next.js 16 (React 19, Turbopack, App Router)
- **Styling**: Tailwind CSS with automatic Light/Dark system synchronization
- **Icons & Visuals**: Lucide React + Vector SVG Brand Assets

### Storage & Telemetry Layer
- **Client Session Store**: Local state engine with automatic canonical role auto-healing
- **Cloud Backend**: Supabase (PostgreSQL with Row-Level Security policies)
- **Signal Aggregator**: Passive workstation activity listener + OAuth webhook ingestion endpoints

---

## 4. Role-Based Access Control (RBAC)

AI Wellness Twin enforces **strict, bi-directional role isolation**:

| Dimension | Employee Role (`employee`) | HR Admin Role (`hr`) |
| :--- | :--- | :--- |
| **Primary Route** | `/dashboard` | `/hr` |
| **Access Boundary** | Strictly restricted to personal data; zero access to `/hr` routes. | Strictly restricted to aggregated team views; zero access to `/dashboard`. |
| **Data Visibility** | Raw individual telemetry, personal surveys, AI twin score, weekly reports. | Anonymized group health indices, macro department shifts ($k \ge 3$). |
| **Account Management** | Personal profile, integration API tokens, theme density. | Organization verification, team creation, single-use invite generator. |

---

## 5. Employee Experience Portal Walkthrough (`/dashboard`)

### 1. Overview (`/dashboard`)
- **Twin Health Score (0–100)**: Composite vitality metric based on rest buffers, focus continuity, and workload pace.
- **Burnout Risk Radar**: Multi-axis diagnostic across Exhaustion, Cynicism, Workload Friction, and Boundary Erosion.
- **Workday Signals by App**: Live 3x3 grid showing active time recorded across all 9 connected tools with direct linking shortcuts.

### 2. Work Pattern Diagnostics (`/dashboard/patterns`)
- Detailed breakdown of meeting density vs. uninterrupted deep-work blocks.
- After-hours activity tracking outside core company hours.

### 3. Burnout Assessment Surveys (`/dashboard/assessment`)
- Standardized Maslach Burnout Inventory (MBI-GS) validated questionnaires.
- Daily subjective pulse logs to cross-correlate subjective feelings with objective telemetry.

### 4. Personalized Recommendations (`/dashboard/recommendations`)
- AI-tailored micro-habits (e.g., "Schedule a 25-minute buffer before 3 PM syncs", "Enable GitHub notification curfew").

### 5. Personal Weekly Reports (`/dashboard/reports`)
- Automated retrospective reports detailing weekly shifts compared against the user's historical 28-day baseline.

### 6. Integrations Manager (`/dashboard/integrations`)
- Cloud and workstation connector hub for GitHub, VS Code, ChatGPT, Gemini, Claude, Google Calendar, Figma, Slack, and Discord.

---

## 6. HR Workforce Administration Portal (`/hr`)

### 1. Workforce Overview (`/hr`)
- Aggregated organizational wellbeing health indices across all certified departments.
- Meaningful Change Detection indicator alerting leadership to systemic workload spikes without singling out individuals.

### 2. Teams & Groups Management (`/hr/teams`)
- Create departmental groups (e.g., Engineering, Design, Product).
- Enforce **$k$-Anonymity**: Groups with $< 3$ active members display a protective privacy lock to prevent deducing personal metrics.
- **Single-Use Invite Generator**: Provision cryptographically unique invite links for onboarding new employees.

### 3. Workforce Trends (`/hr/trends`)
- Longitudinal heatmaps tracking company-wide rest patterns, meeting volume, and boundary sustainability over multiple quarters.

---

## 7. Telemetry Integrations & Data Ingestion Engine

AI Wellness Twin integrates with 9 core productivity tools via a **Zero-Content Metadata Ingestion Pipeline**:

```
                               ┌───────────────────────────┐
                               │     Productivity Tool     │
                               │  (Slack, GitHub, VS Code) │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  METADATA FIREWALL SHIELD │
                               │  ❌ Strip Prompt Text     │
                               │  ❌ Strip Code Contents   │
                               │  ❌ Strip Meeting Titles  │
                               │  ✅ Keep Timestamps Only  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  Wellness Twin Telemetry  │
                               │  (Duration & Pacing Only) │
                               └───────────────────────────┘
```

### Supported Integrations:
1. **GitHub**: Commits, PR reviews, and push timestamps to calculate coding windows.
2. **Visual Studio Code**: Active editor focus time, typing pace, and uninterrupted coding blocks.
3. **ChatGPT (OpenAI)**: AI consultation session timestamps (*prompt text strictly discarded*).
4. **Google Gemini**: Research & analysis session windows (*prompt text strictly discarded*).
5. **Claude (Anthropic)**: Writing and cognitive pacing sessions (*prompt text strictly discarded*).
6. **Google Calendar / Outlook**: Meeting start/end times and gap durations (*event titles discarded*).
7. **Figma**: Creative canvas focus blocks and session durations.
8. **Slack**: Messaging timestamps outside core hours to monitor after-hours communication.
9. **Discord**: Voice and community chat activity windows.

---

## 8. Privacy Architecture & $k$-Anonymity Guarantees

1. **Strict Non-Comparative Evaluation**:
   Employees are only measured against their own established 28-day baseline. There are zero leaderboards, peer rankings, or competitive metrics.
2. **Strict $k$-Anonymity ($k \ge 3$)**:
   Aggregated organizational observations require a minimum of 3 eligible employees in a group before any metrics can be rendered to HR.
3. **Zero Keystroke / Raw Content Logging**:
   The metadata firewall strips all text, code snippets, chat messages, and prompt prompts before ingestion.
4. **Role Isolation**:
   Employees cannot view HR administrative data; HR administrators cannot view employee personal twin diagnostics.

---

## 9. Deployment & Configuration Runbook

### Prerequisites
- Node.js 20+
- npm or yarn

### Local Setup
```bash
# 1. Clone the repository
git clone https://github.com/ronnielmharlssb-dot/ai-wellness-twin.git
cd ai-wellness-twin

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

### Production Build & Deployment
```bash
# Build optimized production bundle
npm run build

# Start production server
npm start
```
The application is pre-configured for automated continuous deployment to Vercel upon pushes to `main`.

---

## 10. Test Accounts & Verification Guide

For evaluators and reviewers testing the live application at [https://ai-wellness-twin.vercel.app](https://ai-wellness-twin.vercel.app):

| Role | Test Account Email | Password | Landing Portal | Capabilities to Test |
| :--- | :--- | :--- | :--- | :--- |
| **Employee (Organic)** | `ronnie@company.com` | `password123` | `/dashboard` | • Pure Day 1 Baseline<br>• Organic Telemetry Signals<br>• Workstation Heartbeats<br>• MBI-GS Assessment<br>• Twin Simulator |
| **HR Admin** | `hr@company.com` | `password123` | `/hr` | • Workforce Health Overview<br>• Teams & $k$-Anonymity Shield<br>• Single-Use Invite Token Generator<br>• Organizational Trends |
| **Calibrated Demo** | `demo@company.com` | `password123` | `/dashboard` | • **Fully Established 28-Day Baseline**<br>• Pre-seeded Telemetry & Connected Apps<br>• 1-Click Calibration & Reset Controls |

> **Tip**: You can use the **1-click instant demo login buttons** on the login page for effortless switching between the pure organic account, HR Admin, and the fully calibrated 28-day demo account.
