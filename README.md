# UNCOVER — Multi-Agent Research & Fact-Checking Platform
> **Tagline:** *"Go Beyond Information. Uncover the Truth."*  
> **Hackathon:** PromptWars X Agent X 2.0  
> **Problem Statement:** PS03 — Multi-Agent Research & Fact-Checking

---

## 1. Project Overview

**UNCOVER** is a production-ready, deployment-friendly multi-agent research and factual verification platform. Unlike single-prompt AI tools that frequently hallucinate or generate ungrounded answers, UNCOVER coordinates **four decoupled, specialized autonomous AI agents** to deconstruct inquiries, retrieve real-time indexed web evidence via Tavily, corroborate claims with empirical certainty, detect cross-source contradictions, and assemble publishable, cited intelligence dossiers.

---

## 2. Core Architecture & Four Independent Agents

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
                                  │  4-Tier Truth Scorecard & Evidence Quotes
                                  ▼
                     ┌─────────────────────────┐
                     │  03. Conflict Analyst   │
                     │ (Discrepancy Detection) │
                     └────────────┬────────────┘
                                  │  Side-by-Side Confrontation Matrix
                                  ▼
                     ┌─────────────────────────┐
                     │ 04. Report Generator    │
                     │  (Synthesis & Dossier)  │
                     └────────────┬────────────┘
                                  │
                                  ▼
             Executive Research Dossier (PDF / Print / Share)
```

### The Four Agents:

1. **Research Agent (`ResearchAgent.js`)**:
   - Decomposes inquiries into targeted Boolean query angles.
   - Queries live indexed web sources using the **Tavily Search API**.
   - Gathers authentic source titles, URLs, publishers, publication dates, and snippets.
   - Extracts atomic, testable empirical claims with direct source provenance.

2. **Fact-Checker Agent (`FactCheckerAgent.js`)**:
   - Rigorously tests each claim strictly against the collected evidence corpus using Google Gemini structured reasoning.
   - Never verifies based on model prior knowledge alone; evidence must exist in the retrieved corpus.
   - Assigns one of four strict categorical statuses:
     - `VERIFIED`: Directly corroborated by credible sources with concordant data.
     - `PARTIALLY_VERIFIED`: Core premise supported, but key caveats, figures, or scopes diverge.
     - `DISPUTED`: Direct contradiction or refuted premise detected across authoritative records.
     - `UNVERIFIED`: Insufficient or zero empirical corroboration in the collected index.
   - Extracts verbatim supporting and refuting quotes with certainty percentages.

3. **Conflict Analyst Agent (`ConflictAnalystAgent.js`)**:
   - Pinpoints analytical friction between diverse sources (e.g. measurement differences such as DC peak nameplate capacity vs. AC grid-injected power; theoretical tooling vs. operational factory output; baseline timeline discrepancies).
   - Generates a side-by-side confrontation matrix detailing Source A vs. Source B positions and root-cause explanations.

4. **Report Generator Agent (`ReportGeneratorAgent.js`)**:
   - Assembles an executive-grade briefing dossier featuring:
     - Executive summary grounded in verified facts.
     - Key corroborated findings.
     - Categorized claim hierarchy.
     - Conflict analysis summary.
     - Clickable source references with citation keys (`[1]`, `[2]`).
     - Stated empirical limitations.
     - Balanced, objective conclusion.

---

## 3. Technology Stack & Strict Palette

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+ Modules). Zero React, Vue, Angular, Bootstrap, or Tailwind.
- **Backend:** Firebase Cloud Functions (Node.js 20 runtime, serverless HTTPS API).
- **Hosting:** Firebase Hosting with native `/api/**` rewrite to Cloud Functions.
- **AI Intelligence:** Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`).
- **Web Grounding:** Tavily Search API.
- **Client Storage:** LocalStorage for research history, active investigation state, and user preferences.
- **Brand Palette (Strict 60:30:10 Rule):**
  - **60% Brown:** Dark Brown (`#38251E`), Primary Brown (`#654332`), Secondary Brown (`#896750`).
  - **30% Cream:** Cream Base (`#F5EBDD`), Ivory (`#FFFDF8`).
  - **10% Baby Blue:** Signature Baby Blue (`#A9D5E8`), Pale Blue (`#DCECF2`). Zero purple, pink, or neon accents.

---

## 4. Secure API Key & Secret Management

UNCOVER strictly enforces **zero frontend secret exposure**. All API keys for Tavily and Google Gemini are stored and accessed **only on the Firebase Cloud Functions backend** via Firebase Secret Manager.

### Required Secrets:
- `TAVILY_API_KEY`: API key from [Tavily](https://tavily.com/).
- `GEMINI_API_KEY`: API key from [Google AI Studio](https://aistudio.google.com/).

### Setting Secrets in Firebase Secret Manager:
Run these commands in your terminal (do not paste keys in public repositories or client files):

```bash
# 1. Log in to Firebase CLI
firebase login

# 2. Select or set your Firebase project
firebase use <your-project-id>

# 3. Securely set the Tavily API Key
firebase functions:secrets:set TAVILY_API_KEY

# 4. Securely set the Gemini API Key
firebase functions:secrets:set GEMINI_API_KEY
```

### Local Development Secrets:
For running the Firebase Emulator locally without Secret Manager, create a `.env.local` file inside the `functions/` directory (already ignored by `.gitignore`):

```bash
# Inside functions/.env.local (NEVER commit this file)
TAVILY_API_KEY=your_tavily_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

---

## 5. Local Development & Testing

### Prerequisites:
- Node.js version 18 or higher (Node 20+ recommended).
- Firebase CLI (`npm install -g firebase-tools`).

### Quick Start:

1. **Install backend dependencies:**
   ```bash
   cd functions
   npm install
   cd ..
   ```

2. **Option A: Run Static Frontend (Demo Mode):**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in any web browser. Demo Mode works completely offline with zero API keys required!

3. **Option B: Run Full Local Stack with Firebase Emulators:**
   ```bash
   firebase emulators:start
   ```
   This starts Firebase Hosting and Cloud Functions emulators locally, allowing end-to-end testing of both Live and Demo modes.

---

## 6. Firebase Deployment Instructions

Deploying UNCOVER to production takes under two minutes using the Firebase CLI:

```bash
# 1. Verify project selection
firebase projects:list
firebase use <your-project-id>

# 2. Deploy Cloud Functions and Hosting together
firebase deploy

# Or deploy components individually:
firebase deploy --only functions
firebase deploy --only hosting
```

Your live web application will be accessible at:
`https://<your-project-id>.web.app`

---

## 7. Demo Mode vs. Live Mode

| Feature | Demo Mode (`demo=true`) | Live Mode (`demo=false`) |
| :--- | :--- | :--- |
| **Execution** | Completely offline | Firebase Cloud Functions backend |
| **API Keys** | **None required** | `TAVILY_API_KEY` & `GEMINI_API_KEY` |
| **Sources** | Pre-packaged verified empirical datasets | Real-time indexed web search via Tavily |
| **Reasoning** | Curated benchmark verification | Real-time reasoning via Google Gemini API |
| **Labels** | Visibly marked with `✦ DEMO DATASET` badge | Visibly marked with `● LIVE RESEARCH` badge |
| **Inspection** | Inspect real structured inputs/outputs | Inspect real API payloads & execution logs |
| **Persistence** | Saved to browser LocalStorage history | Saved to browser LocalStorage history |

---

## 8. Automated Testing

UNCOVER includes a comprehensive automated test suite for both backend functions and frontend agent orchestration:

```bash
# Run backend validation and unit tests:
npm run test --prefix functions

# Run frontend orchestration integrity tests:
node -e "import('./public/js/orchestrator.js'); import('./public/js/demoData.js').then(d => console.log('Orchestrator ready'));"
```

### Verified Test Cases:
- Missing Tavily API key rejection (`MISSING_TAVILY_KEY`).
- Missing Gemini API key rejection (`MISSING_GEMINI_KEY`).
- Empty / too short / too long query validation.
- Fact-Checker status enforcement (`VERIFIED`, `PARTIALLY_VERIFIED`, `DISPUTED`, `UNVERIFIED`).
- Source URL provenance and domain normalization.
- Offline Demo pipeline execution with all four agents.
- Live mode error interception and graceful downstream agent isolation.

---

## 9. Cost Considerations & Rate Limiting

- **Search Optimization:** Standard depth limits Tavily searches to 4 results; Deep depth expands to 7 results. Redundant queries are filtered.
- **Token Efficiency:** Source snippets and metadata are normalized before sending to Gemini, preventing oversized prompts.
- **Backend Limiter:** The Cloud Function includes an in-memory sliding window rate limiter (30 requests/min/IP) to prevent abuse.
- **Zero Fabrication Guarantee:** UNCOVER never generates synthetic citations or fabricated URLs. If evidence is insufficient, it is marked `UNVERIFIED`.

---

## 10. License

Built for **PromptWars X Agent X 2.0 (Problem Statement PS03)**.  
Released under the MIT License.
