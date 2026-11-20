# UNCOVER — Multi-Agent Research & Fact-Checking Platform
> **Tagline:** *"Go Beyond Information. Uncover the Truth."*  
> **Hackathon:** PromptWars X Agent X 2.0  
> **Problem Statement:** PS03 — Multi-Agent Research & Fact-Checking  
> **Core Experience:** `OPEN WEBSITE → ENTER TOPIC → SEARCH → AGENTS WORK → GET RESEARCH REPORT`

---

## 1. Project Overview

**UNCOVER** is a production-ready, deployment-friendly multi-agent research and factual verification platform designed for academic and intellectual inquiry.

Inspired by the search-first simplicity of **Google Scholar**, UNCOVER eliminates complex multi-step dashboards and confusing configurations:
1. **Search:** The user enters a research question, factual claim, or topic directly into a central, minimalist search field.
2. **Autonomous Collaboration:** Four independent AI agents immediately activate in the background to deconstruct the query, retrieve real-time indexed web evidence via Tavily, corroborate claims with empirical certainty, and detect cross-source contradictions.
3. **Evidence-Backed Report:** The platform compiles and delivers an executive research report complete with key findings, claim verification scorecards, conflict matrices, research limitations, and traceable citations.

---

## 2. The Four Independent Autonomous Agents

```
                        User Research Inquiry
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │   01. Research Agent    │
                     │  (Discovery & Sourcing) │
                     └────────────┬────────────┘
                                  │  Retrieved Sources & Extracted Claims
                                  ▼
                     ┌─────────────────────────┐
                     │ 02. Fact-Checker Agent  │
                     │ (Corroboration & Status)│
                     └────────────┬────────────┘
                                  │  Evidence Scorecard & Verbatim Quotes
                                  ▼
                     ┌─────────────────────────┐
                     │  03. Conflict Analyst   │
                     │ (Discrepancy Detection) │
                     └────────────┬────────────┘
                                  │  Cross-Source Confrontation Matrix
                                  ▼
                     ┌─────────────────────────┐
                     │ 04. Report Generator    │
                     │  (Synthesis & Dossier)  │
                     └────────────┬────────────┘
                                  │
                                  ▼
              Executive Research Report (Print / PDF / Copy)
```

### Agent Responsibilities:

1. **Research Agent (`ResearchAgent.js`)**:
   - Decomposes the research question into targeted query branches.
   - Queries live indexed web sources using the **Tavily Search API**.
   - Gathers authentic source titles, URLs, publishers, publication dates, and authoritative snippets.
   - Extracts atomic, testable empirical claims anchored to primary sources.

2. **Fact-Checker Agent (`FactCheckerAgent.js`)**:
   - Rigorously tests each claim strictly against the collected evidence corpus using Google Gemini structured reasoning.
   - Enforces evidence-based evaluation (never verifies based on prior model memory alone).
   - Assigns one of four categorical statuses:
     - `SUPPORTED` (`VERIFIED`): Directly corroborated by credible sources with concordant data.
     - `PARTIALLY SUPPORTED` (`PARTIALLY_VERIFIED`): Core premise supported, but key caveats, figures, or scopes diverge.
     - `CONTRADICTED` (`DISPUTED`): Direct contradiction or refuted premise detected across authoritative records.
     - `INSUFFICIENT EVIDENCE` (`UNVERIFIED`): Insufficient or zero empirical corroboration in the collected index.
   - Extracts verbatim supporting and refuting quotes with certainty percentages.

3. **Conflict Analyst Agent (`ConflictAnalystAgent.js`)**:
   - Pinpoints analytical friction between diverse sources (e.g. measurement differences such as DC peak nameplate capacity vs. AC grid-injected power; acute attentional fatigue vs. permanent structural brain alteration; surrogate endpoints vs. long-term mortality).
   - Generates a side-by-side confrontation matrix detailing Source A vs. Source B positions and root-cause explanations.
   - If no conflict exists, clearly documents empirical consensus.

4. **Report Generator Agent (`ReportGeneratorAgent.js`)**:
   - Assembles an executive-grade briefing dossier featuring:
     - Executive summary grounded in verified facts.
     - Key corroborated empirical findings.
     - Categorized claim hierarchy with quotes.
     - Cross-source conflict analysis.
     - Research limitations and scope boundaries.
     - Balanced, objective conclusion.
     - Clickable, numbered references with citation keys (`[1]`, `[2]`).

---

## 3. Technology Stack & Strict Brand Palette

- **Frontend:** Pure HTML5, CSS3, Vanilla JavaScript (ES6+ Modules). **Strictly zero** React, Next.js, Vue, Angular, Bootstrap, or Tailwind.
- **Backend:** Firebase Cloud Functions (Node.js 20 / 22 runtime, serverless HTTPS API).
- **Hosting:** Firebase Hosting with native `/api/**` rewrite to Cloud Functions.
- **AI Intelligence:** Google Gemini API (`gemini-1.5-flash` / `gemini-2.5-flash`).
- **Web Grounding:** Tavily Search API.
- **Client Storage:** LocalStorage via `StorageService` for research history, active state, and user preferences.
- **Brand Palette (Strict 60:30:10 Rule):**
  - **60% Brown:** Primary Brown (`#654332`), Dark Brown (`#38251E`), Secondary Brown (`#896750`).
  - **30% Cream:** Cream Base (`#F5EBDD`), Ivory Canvas (`#FFFDF8`), Subtle Cream (`#FAF4EB`).
  - **10% Baby Blue:** Signature Baby Blue (`#A9D5E8`), Pale Blue (`#DCECF2`), Deep Blue (`#78B3CD`). Zero purple, pink, or neon accents.

---

## 4. Secure API Key & Secret Management

UNCOVER strictly enforces **zero frontend secret exposure**. All API keys for Tavily and Google Gemini are stored and accessed **only on the Firebase Cloud Functions backend** via Firebase Secret Manager.

### Required Backend Secrets:
- `TAVILY_API_KEY`: API key from [Tavily](https://tavily.com/).
- `GEMINI_API_KEY`: API key from [Google AI Studio](https://aistudio.google.com/).

### Setting Secrets via Firebase CLI:
Run these commands in your terminal (never commit secrets to git):

```bash
# 1. Log in to Firebase CLI
firebase login

# 2. Set your Firebase project
firebase use <your-project-id>

# 3. Securely set the Tavily API Key
firebase functions:secrets:set TAVILY_API_KEY

# 4. Securely set the Gemini API Key
firebase functions:secrets:set GEMINI_API_KEY
```

### Local Development with Secrets:
For running Firebase Emulators locally without Secret Manager, create `functions/.env.local` (already ignored by `.gitignore`):

```bash
# Inside functions/.env.local (NEVER commit this file)
TAVILY_API_KEY=your_tavily_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 5. Local Development & Quick Start

### Prerequisites:
- Node.js version 18 or higher (Node 20+ recommended).
- Firebase CLI (`npm install -g firebase-tools` or via `npx firebase-tools`).

### Quick Start Commands:

```bash
# 1. Install backend dependencies:
npm --prefix functions install

# 2. Run automated tests (backend + frontend):
npm test

# 3. Option A: Run Static Frontend (Demo Mode):
npm start
# Open http://localhost:3000 in your browser. Demo mode operates 100% offline!

# 4. Option B: Run Full Local Stack with Firebase Emulators:
npm run serve
# Or: firebase emulators:start
```

---

## 6. Pre-Packaged Demo Scenarios (Offline Verification)

UNCOVER includes **5 authentic pre-compiled empirical benchmark scenarios** that run completely offline without requiring API keys:

1. **AI in Education:** Generative AI in Classrooms — Personalized Learning Gains vs. Cognitive Offloading.
2. **Climate & Energy:** Global Solar Photovoltaic Capacity — 2.0 Terawatt Milestone Assessment (2024).
3. **Cognitive Science:** Social Media Algorithms and Cognitive Attention Span — State Fatigue vs. Trait Deficit.
4. **Physics & Computing:** Quantum Computational Advantage Status — Practical Utility vs. Classical Benchmarks.
5. **Public Health:** Dietary Sodium Restriction & J-Curve Mortality Debate.

---

## 7. Automated Test Suite

UNCOVER features an automated test harness covering backend contracts, security boundaries, and agent state machines:

```bash
# Run all automated tests:
npm test

# Run backend tests only:
npm run test:backend

# Run frontend orchestrator tests only:
npm run test:frontend
```

### Test Coverage (18 Passed, 0 Failed):
- Secret omission rejection (`MISSING_TAVILY_KEY`, `MISSING_GEMINI_KEY`).
- Query validation (empty, < 3 chars, > 500 chars).
- Strict 4-tier verification status enforcement (`VERIFIED`, `PARTIALLY_VERIFIED`, `DISPUTED`, `UNVERIFIED`).
- Tavily URL normalization, publisher domain extraction, and citation numbering.
- End-to-end multi-agent pipeline contract with mock responses.
- Offline Demo pipeline execution with all 4 agents completing.
- Honest live error handling when backend is unreachable (zero fake completion).
- Query keyword matcher mapping to authentic benchmark datasets.
- StorageService LocalStorage persistence and fallback behavior.

---

## 8. Firebase Production Deployment Instructions

Deploying UNCOVER to production takes under two minutes:

```bash
# 1. Log in to Firebase CLI
firebase login

# 2. Select your Firebase project
firebase use <your-project-id>

# 3. Deploy Cloud Functions and Hosting together
firebase deploy

# Or deploy individually:
firebase deploy --only functions
firebase deploy --only hosting
```

Your live web application will be accessible at:  
`https://<your-project-id>.web.app`

---

## 9. License

Built for **PromptWars X Agent X 2.0 (Problem Statement PS03)**.  
Released under the MIT License.
