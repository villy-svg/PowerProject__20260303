---
name: safe-code-modification
description: Use when modifying, refactoring, or adding code to any existing file, or when writing CSS. Mandatory to prevent logic deletions, preserve comments, and maintain CSS architecture.
---

# Safe Code Modification & CSS Best Practices

## Overview
This skill defines the **Code Preservation Protocol** and **CSS Integrity Standards**. AI agents (including Gemini, Claude, and others) frequently cause rework by dropping existing logic, removing imports, or breaking style cascades. This document provides strict rules to ensure all code modifications are safe, additive, and maintainable.

## When to Use
- **Mandatory** before making ANY edit to an existing codebase file.
- Use when implementing new features, bugfixes, or refactoring.
- Use when writing or modifying CSS, SCSS, or style tags.

---

## 1. Code Preservation Protocol

### A. The "Do No Harm" Rule
- **Never Overwrite Blindly**: Avoid full-file rewrites for large files. Use targeted replacement tools (e.g., `replace_file_content`) to modify only the necessary lines.
- **Anchor Verification & Duplicate Lines (Corner Case)**: Before executing a replacement, verify that the target text exactly matches the existing file content. **Corner Case**: If the line you are targeting (e.g., `</div>`) appears multiple times, your target block MUST include unique preceding or succeeding lines to act as a unique anchor.
- **Logic Retention & Dynamic Usage**: Do not delete unrelated utility functions, dead code (unless explicitly asked), or fallback logic. **Corner Case**: What looks like "dead code" or an unused CSS class might be constructed dynamically (e.g., `className={"status-" + status}`) or used via eval/reflection. LEAVE IT ALONE.

### B. Import & Dependency Safety
- **Additive Imports**: When adding new dependencies, append them to the import block. NEVER remove existing imports.
- **Naming Collisions (Corner Case)**: If importing a component that shares a name with an existing local variable or import, use aliases (e.g., `import { Card as UICard } from './ui'`) to prevent silent shadowing.
- **Circular Dependencies (Corner Case)**: Before importing File A into File B, ensure File B doesn't already import File A. If it does, refactor the shared logic into a neutral File C.
- **Dependency Validation**: Before touching any code block, validate its internal and external dependencies. Carefully analyze how the modification will impact downstream consumers, parent/child components, and related modules.

### C. Documentation & Comments
- **Preserve Existing Comments**: Never strip out TODOs, JSDoc, or inline explanations.
- **Mandatory Documentation for Changes**:
  - Add a concise comment explaining *why* a change was made.
  - Use standard comment syntax: `//` for JS/TS, `/* */` for CSS, `<!-- -->` for HTML.
  - For complex logic, add a block comment explaining the algorithm or edge case handled.

### D. Modularity & Component Union (CRITICAL & DETAILED)
- **Absorb and Refactor**: When discovering that two components share similar structures or logic, YOU MUST NOT duplicate the code. Instead, build a new **modular component** that absorbs the **union** of the two.
- **Handling Conflicting Props (Corner Case)**: If Component A uses `title` and Component B uses `headerText`, the unified component should standardize the prop (e.g., `title`) and handle mapping internally, or accept both with a fallback (`const displayTitle = title || headerText`).
- **State vs Props (Corner Case)**: If Component A manages internal state but Component B receives state via props, the unified component MUST be "controlled by default, uncontrolled as fallback." Accept state via props, but initialize local state if those props are `undefined`.
- **Safe Sub-Component Refactoring**: After creating the modular base, refactor the existing sub-components to wrap or utilize the new modular component. 
- **Zero Breakage Guarantee**: During this refactoring, YOU MUST NOT break existing functionality. The new modular component must accept all props necessary to replicate the previous behavior exactly. This MUST be done with strict MODULARITY.

---

## 2. CSS Integrity & Best Practices

AI agents often cause "CSS Specificity Wars" by dumping global styles. Follow these rules to avoid rework:

### A. Design System Compliance
- **Strict Variable Usage**: You MUST use CSS variables for spacing, colors, and typography. Reference the existing design tokens in [ui-design-system](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/ui-design-system/SKILL.md).
- **No Hardcoded Hex/RGB**: Hardcoded colors are a violation. Use `var(--color-name)` or `color-mix()`.
- **Prioritize Reusability**: Always prioritize reusing existing global styles and refactored component classes instead of writing duplicate CSS rules. Before drafting new styles, verify if an established pattern already covers the use case.

### B. Architecture & Scoping
- **Component Scoping**: Ensure styles are scoped to the component to prevent global leakage. Use CSS Modules, unique class prefixes, or nested selectors.
- **BEM Methodology**: Use the Block-Element-Modifier pattern for class names (e.g., `.card`, `.card__title`, `.card__title--active`).
- **Specificity & Legacy Overrides (Corner Case)**: 
  - Avoid using `!important`. If you must override a legacy global style that has high specificity, use a combined selector (e.g., `.my-component.my-component--active`) rather than `!important` to safely bump specificity.
  - Avoid overly deep selectors (e.g., `div > ul > li > a`). Keep specificity as low as possible.
  - **Inline Styles (Corner Case)**: When refactoring inline styles into classes, verify that JavaScript wasn't dynamically updating those inline styles (e.g., `style={{ height: dynamicHeight }}`). If it is, keep the dynamic parts inline and move static parts to CSS.

### C. Modern Layout Standards
- **Responsive clamp()**: Use `clamp()` for fluid typography and spacing rather than rigid breakpoints.
- **Flexbox/Grid**: Always prefer Flexbox and Grid for layouts. Avoid absolute positioning unless creating overlays.
- **Safe Area Insets**: Account for mobile notches using `env(safe-area-inset-top)`.

---

## 3. Pre-Flight Checklist for AI Models
Before submitting any tool call that modifies code, confirm:
1. [ ] I have read the target line range in full.
2. [ ] My replacement block includes all necessary logic and DOES NOT delete existing sibling lines.
3. [ ] I have added explanatory comments for new logic.
4. [ ] I validated dependencies to ensure modifications don't break downstream modules.
5. [ ] (CSS) I prioritized reusing global/refactored styles and used design system variables.

---

## 4. Advanced AI Workflow Safeguards (Anthropic/Google Standard)
When an LLM operates on a complex codebase, the margin for error is razor-thin. Adhere to these advanced meta-heuristics to prevent catastrophic refactoring failures.

### A. The "Standalone Sandbox" Rule
- **Isolated Verification:** If you are asked to introduce a highly complex algorithm or modify an intricate core module, do not mutate the production file immediately. Write a standalone test script or a scratch file in `/scratch/` first. Verify the logic works in a vacuum before transplanting it into the heavily coupled production code.
- **Explain First, Edit Later:** For legacy or highly obscure code, perform an "understanding pass" first. Explain what you believe the code does in a comment or plan before attempting to edit it. If you misinterpret the context, the user can correct you before damage is done.

### B. Structural vs Textual Modification
- **AST (Abstract Syntax Tree) Awareness:** Mentally parse the code as a tree, not as strings. When replacing code, ensure you are swapping out a complete logical node (an entire function, an entire `if` block) rather than breaking braces or corrupting the lexical scope.
- **Never Truncate Functions:** When asked to edit the beginning of a 200-line function, NEVER output the first 50 lines and append `// ... rest of code`. You must use targeted `multi_replace_file_content` chunks for the specific lines, leaving the rest of the function physically untouched by the tool call.

### C. Git and Version Control Synergy
- **Incremental Steps over Giant Leaps:** The LLM's enemy is the monolithic, multi-file edit. Break tasks down into atomic, highly specific commits. If a user asks for a massive feature, execute it in phases (e.g., Phase 1: Data Models, Phase 2: Services, Phase 3: UI Integration).
- **The Stash and Revert Mindset:** If midway through a change you realize the approach is deeply flawed, do not attempt to "hack" it into working. Stop, advise the user to `git restore` or `git checkout .`, and formulate a completely new strategy.

### D. Deep Context Anchoring
- **Avoid Overloading Context:** Do not fetch 15 files at once if you are only editing one. Too much context dilutes the LLM's attention mechanism and leads to "hallucinated deletions" where the model forgets what the original file looked like.
- **Provide "Grounding" Documentation:** If modifying code that heavily interacts with a specific internal standard (like RBAC or Hot-Cold Archival), you MUST read the relevant `SKILL.md` file FIRST to ground your generation in the repository's ground truth.

### E. AI-Specific CSS Architectures
- **The Fallback Cascade:** When generating new CSS, especially for adaptive UI components, always write the most defensive fallback possible. If `gap: 1rem` fails in an older browser context, ensure flex margins or grid fallbacks are mentally considered.
- **Zero Placeholder Policies:** When creating UI components, never use generic placeholders like `<img src="placeholder.png" />`. Either integrate the actual data pipeline immediately or utilize the `generate_image` tool to create a production-accurate asset for the demo.
