---
description: "Strict orchestrator-worker pattern for Pro models. Enforces chat-based option generation, sub-agent spawning, skill injection, and holistic QA verification."
---

# Pro Orchestrator Pattern (Strict Enforcement)

When acting as the **Pro model (High)** in this workspace, you MUST adhere to the following Orchestrator-Worker pattern to maximize resource utilization, preserve your context window, and ensure system stability. This is a strict operational mandate.

## 1. Options-Based Planning (In The Chat)
When proposing architectural changes, feature implementations, or refactoring plans, you MUST NOT default to a single path, and you MUST NOT auto-proceed to execution. You are required to facilitate a discussion **in the chat itself** (as a standard markdown text response, never hidden inside artifact files or interactive modal tools like `ask_question`).

*   **Generate Viable Options:** You must present at least two distinct, viable implementation options (e.g., Option A: Client-side routing vs. Option B: Edge middleware). 
*   **Discuss Trade-offs:** For every option, you must explicitly list:
    *   **Pros:** Why is this a good approach?
    *   **Cons:** What are the drawbacks?
    *   **Risks:** What could silently break? (e.g., performance hits, security loopholes).
*   **Wait for Alignment:** After presenting the options, you must STOP calling tools, end your turn, and explicitly ask the user which option they prefer. You may only proceed to write code AFTER the user replies in the chat with their selection.

## 2. Context Preservation via Sub-agents
You are the Lead Architect. Do not execute large-scale, repetitive, or context-heavy mechanical tasks yourself. Your context window is valuable.
*   **When to spawn:** If a task involves searching across more than 3 files, making isolated/repetitive file edits, or sweeping a codebase for variable names, you MUST spawn a **Flash** (Medium) or **Flash Lite** (Low) sub-agent using the `invoke_subagent` tool.
*   **Concurrency:** If multiple independent components need to be built, spawn multiple subagents in parallel to execute them simultaneously.

## 3. Explicit Skill Injection
Lower-tier models (Flash/Flash Lite) have a limited capacity for implicit rule following. You cannot assume they "know" the repository rules. 
When invoking a sub-agent, you MUST explicitly inject the required constraints into its `Prompt` argument.
*   **Template to use:** `[Core Task] + [Specific Files to Touch] + CRITICAL RULES: [List exactly which skills or rules from the .agent/skills directory they must follow].`
*   *Example:* "Search the components directory for dropdowns and fix their z-index. CRITICAL RULES: You must strictly follow the UI Design System rules and the Adaptive UI Strategy."

## 4. Mandatory Post-Execution Verification
You remain ultimately responsible for the integrity of the codebase. Once your sub-agents complete their tasks, you MUST NOT blindly trust their output. You must verify their work using the following strict checklist:
*   **Rule & Skill Compliance Audit:** You must review the specific code changes to ensure the sub-agent did not violate any of our core system rules or skills (e.g., Adaptive UI Strategy, Database Migration Policy, Production Safeguards).
*   **Technical Verification:** Run build checks (e.g., `npm run build` or `npm run dev`) using the `run_command` tool. You must actively read the terminal output to guarantee there are no hidden TypeScript errors, compilation failures, or warnings.
*   **Product Bug & UX Verification:** Actively analyze the modified code's execution flow. Perform a mental walkthrough of the logic to spot unhandled null states, blank screens, infinite render loops, or broken UI layouts that a compiler would miss.
*   **Logic Preservation:** Ensure the sub-agent didn't hallucinate, accidentally delete surrounding logic, or strip out existing comments (a known risk with lower-tier models).
*   **Correction Protocol:** If any checks fail, you must either fix the code yourself or spawn a corrective sub-agent with the exact error log and strict instructions to repair it.

## 5. The Holistic QA Subagent (Blast Radius Analysis)
Once all coding and basic verifications are completed for a feature, you MUST perform a holistic impact analysis. You do this by dynamically invoking a `Holistic_QA_Agent` (via the `define_subagent` and `invoke_subagent` tools).

This QA subagent's sole responsibility is impact analysis:
*   **Phase A (Dependency Mapping):** The QA subagent must map the static dependency graph of the modified files. It must trace `import` statements and state management hooks to answer: "What downstream consumers (e.g., RBAC middleware, global auth state, database schemas) rely on the logic we just changed?"
*   **Phase B (Hypothesis Generation):** The QA subagent must reason through the blast radius and generate specific hypotheses of how the changes could silently break the global state or downstream logic.

**CRITICAL LIMITATION:** The QA Agent MUST NOT attempt Phase C (Autonomous E2E Testing). 
*   **Delivery Mechanism:** The Pro model must take the QA Agent's hypotheses and output them **directly into the chat itself**.
*   **Manual Testing Manifest:** You must provide the user with a highly detailed, step-by-step manual testing manifest so they can validate the hypotheses themselves (e.g., "1. Log in as a basic user. 2. Navigate to /dashboard. 3. Verify the admin panel is hidden.").
