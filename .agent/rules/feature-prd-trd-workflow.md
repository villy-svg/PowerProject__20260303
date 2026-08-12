---
description: >
  MANDATORY GATE: Before building, refactoring, or making significant architectural changes,
  the AI MUST create and maintain a persistent PRD/TRD document in docs/features/. No code
  may be written until the user has explicitly approved the plan. This document is the source
  of truth for all agreed logic, flows, and decisions.
---

# Persistent Feature Planning Workflow (PRD/TRD Gate)

## What Is This Rule?

This rule is a **hard gate**. It prevents "just start coding" behavior by requiring a
formalized planning phase before any feature work begins. The goal is to:

1. Surface all hidden dependencies before they become bugs.
2. Create a shared, version-controlled agreement (PRD/TRD) between the user and AI.
3. Ensure every agreed decision is documented so future developers and AI models have context.

---

## CRITICAL: What Triggers This Rule?

You MUST activate this workflow when the user says ANY of the following (or similar):

- "Let's build X"
- "Add a feature that does Y"
- "I want to create Z"
- "Refactor A to work like B"
- "Let's overhaul / redesign / restructure..."
- "Can we add X to the database?"
- "Let's add a new page / board / view"
- "Can we change how X logic works?"

You do NOT need to activate this workflow for:

- Minor bug fixes (single-line or single-component corrections)
- Copy or label changes (text only, no logic)
- Purely cosmetic CSS tweaks that don't affect layout or logic
- One-off investigative questions ("Explain how X works", "Why does Y happen?")

When in doubt, **always activate the workflow**.

---

## Step-by-Step Mandatory Workflow

### STEP 1: Pause — Do Not Write Code

Immediately upon receiving a qualifying request, STOP. Output this acknowledgment:

> "Before we write any code, I'll draft a Feature Planning Document (PRD/TRD) for us to
> review and agree on. This ensures we surface all dependencies, debate the options, and
> only build what we've explicitly agreed upon."

### STEP 2: Research the Existing Codebase

Before writing anything, scan the relevant parts of the codebase to understand the current
state. Do this by:

- Reading the relevant feature directory (e.g., `src/features/<FeatureName>/`)
- Checking the Supabase schema for related tables (reference `db_types.ts` at project root)
- Checking for existing hooks or services that touch this area
- Identifying which RBAC roles and `get_user_permission_level` policies apply
- Identifying which UI shells are involved (DesktopLayout vs MobileLayout)

### STEP 3: Create the PRD/TRD Document

Create a new markdown file at: `docs/features/<feature_name>.md`

**Naming convention:** Use lowercase snake_case. Examples:
- `docs/features/employee_shift_management.md`
- `docs/features/client_portal_access.md`
- `docs/features/analytics_dashboard_v2.md`

**IMPORTANT:** Never overwrite an existing document without first reading it and preserving
prior decisions. If a document already exists for this feature, update it with a new dated
section (e.g., `## Update: 2026-08-12`) rather than replacing it.

Copy the exact structure from `docs/features/_template.md` and fill in **all** sections.
Do not skip sections. If a section is genuinely not applicable, write "N/A — [brief reason]"
so future readers understand why it was skipped.

### STEP 4: Fill In All Phases

The template has 4 phases. Each must be filled with real, specific information — not
generic placeholders:

#### Phase 0 — Context & Objectives
- State the core problem in one or two clear sentences (not just the user's words, but
  your interpretation of the root problem).
- Define measurable success criteria (not vague goals like "users are happy" — instead,
  something verifiable like "users can complete the onboarding flow without leaving the
  screen" or "API response time < 200ms").
- List explicit out-of-scope items. This prevents scope creep during execution.

#### Phase 1 — Current State & Dependencies
This is the most critical phase. Do NOT skip any sub-item:

- **1a. Technical:** Name the specific React components, hooks, Edge Functions, and API
  routes that currently manage this feature area. Include file paths.
- **1b. Product:** Describe the current user flow step by step. What does the user
  currently see? What actions can they take?
- **1c. Logical:** What are the business rules that currently govern this area?
  (e.g., "Only managers can approve timesheets", "A shift cannot start before the previous
  one ends").
- **1d. Data & State:** List every Supabase table, view, or bucket that this feature reads
  from or writes to. List the relevant columns. Note any foreign key relationships.
- **1e. Security & Access (RBAC):** State which permission levels can access this feature
  (Admin, Editor, Contributor, Viewer). Describe how the Sphere of Influence applies —
  does a manager only see their own team's data? Does seniority gate write access?

#### Phase 2 — Proposed Options & Strategy
Present **at least two** options for the implementation. Do not jump to the conclusion.
The user should be able to choose or blend approaches.

- **2a. Technical Options:** List architecture choices. For example: "Option A: Handle in
  an Edge Function for server-side security. Option B: Handle in a React hook for simpler
  deployment." For each option, note pros/cons.
- **2b. Product Options:** What different UI/UX experiences could we build? What does the
  Desktop (high-density management view) look like vs the Mobile (focused action view)?
- **2c. Logical Options:** Are there different ways to model the data or express the
  business rule? (e.g., "Option A: Store computed fields. Option B: Calculate on-the-fly
  with a DB function.")
- **2d. Trade-offs:** For the RECOMMENDED approach, explicitly state:
  - What we gain: (e.g., "Server-side security, no bypass possible")
  - What we sacrifice: (e.g., "Slower to deploy, requires a new migration")
  - What the alternative costs: (e.g., "Option B is faster but can be bypassed via Postman")
- **2e. Rollout & Backward Compatibility:** How will this be deployed?
  - Will it be behind a feature flag?
  - Does it require a database migration? If yes, is the migration reversible?
  - Does it affect the Capacitor-packaged mobile app? Do older mobile app versions that
    haven't updated via OTA need a fallback behavior?

#### Phase 3 — Risks, Mitigation & Verification
A pre-mortem. Think about what can go wrong BEFORE we build it.

- **3a. Technical Risks:** Could this cause performance issues? Does it introduce a race
  condition? Could a wrong query corrupt data? List the risk and state the mitigation.
- **3b. Product Risks:** Could users be confused by the new flow? Could it conflict with
  an existing mental model? Could it break a current workflow users rely on?
- **3c. Logical Risks:** Are there edge cases in the business logic? (e.g., "What happens
  if an employee has no manager?", "What if a shift spans midnight?")
- **3d. Testing Plan:** Be specific. List exact test scenarios:
  - "Log in as a Viewer and verify the Create button is hidden."
  - "Create a record, then delete it, and verify it no longer appears in any list."
  - "Test on a mobile viewport to confirm the layout switches correctly."
- **3e. Rollback & Reversibility:** If this breaks in production after deployment:
  - What is the exact rollback procedure? (e.g., "Revert the migration with
    `supabase db reset` on staging, then deploy previous app version via OTA.")
  - Is the change reversible without data loss?

### STEP 5: Present for Debate

After filling in all phases, present the document to the user. State explicitly:

> "Here is the PRD/TRD draft for [Feature Name]. I've identified [X] open questions that
> need your input before we lock in the strategy. Please review Phase 2's trade-offs and
> confirm which option you prefer."

Point out any open questions by listing them clearly. Do NOT ask more than 3–4 questions
at a time. Wait for the user's response before proceeding.

### STEP 6: Iterate Until Approved

Update the document based on user feedback. Change the status at the top of the document:

- `Draft` → You have written the initial document
- `In Review` → The user is actively debating and giving feedback
- `Approved` → The user has explicitly said they approve the strategy

**You MUST NOT proceed to execution until the status is `Approved`.**

### STEP 7: Execute Against the Document

Once approved:
- Implement exactly what is described in the document. If you discover a technical blocker
  that requires deviating from the plan, STOP and update the document before continuing.
- After execution, update the document's status to `Implemented` and add a brief
  `## Implementation Notes` section with any relevant deviations or discoveries.

---

## Non-Negotiable Rules

- **NEVER** write code before Phase 0 is agreed upon. Writing code without a plan is a
  violation of this rule regardless of how simple the feature seems.
- **NEVER** skip Phase 1. Hidden dependencies are the #1 cause of production regressions.
- **NEVER** replace an existing `docs/features/` document without first reading it.
  Historical decisions must be preserved or explicitly overridden with a reason.
- **ALWAYS** reference the `docs/features/_template.md` file for the canonical structure.

---

## Cross-Rule Integration

This rule works in concert with other workspace rules. When filling out the PRD/TRD,
you MUST consult the following rule files to ensure the plan is compliant:

| Rule File | When to Apply |
|---|---|
| `rbac-and-security.md` | Any feature that reads or writes user data |
| `database-standards.md` | Any feature that modifies the DB schema |
| `production-safeguards.md` | Any change touching a production-exposed component |
| `architecture-and-modularity.md` | Any feature requiring new components or refactoring |
| `mobile-and-archival.md` | Any feature that affects the Capacitor mobile app |
| `adaptive-shell-architecture.md` | Any feature that changes a page's layout or shell |
