---
name: production-safeguards
description: CRITICAL MANDATORY RULES for modifying ANY production-exposed feature. You MUST read and follow this protocol before editing any code.
---

# Production Safeguards (Skill Mirror)

*Note: This is a mirrored skill of the global `production-safeguards.md` rule, kept here for safety and strict adherence.*

**CRITICAL DIRECTIVE**: You are modifying a production codebase. Moving fast can break things that are exposed to real users. 

Before using ANY file editing tools or executing ANY commands that modify the codebase, you MUST evaluate if the change touches a "Production Exposed" area.

## 1. Defining "Production Exposed"
A file, component, or feature is considered "Production Exposed" if:
- It contains the annotation `// @prod-critical` or `// @stable` at the top of the file.
- It is a core feature actively used by users (e.g., authentication, billing, main UI dashboards).
- You are unsure. If you are unsure, default to treating it as Production Exposed.

## 2. The Explicit Consent Protocol
If the task requires modifying a Production Exposed area, you MUST NOT apply changes linearly or change-by-change. Instead, you MUST:
1. **Trigger Planning Mode:** Stop executing code modifications. Conduct thorough research first.
2. **Draft a Single Comprehensive Plan:** Create an `implementation_plan.md` artifact detailing *all* planned changes across the codebase.
3. **Provide Deep-Dive Impact Analysis:** Within this plan, detail both the **Technical Impact** (files touched, dependencies, state, DB schema) AND the **Product Impact** (how this affects existing features, user experience, usability, and potential disruption to live users).
4. **Present Options:** Give the user clear architectural or implementation options to choose from, highlighting the trade-offs of each.
5. **Request Explicit Approval:** Ask the user to make a decision and explicitly approve the plan before you begin writing any code.

## 3. Architecture & Safety First
- **No breaking changes without review.**
- Always check if a change should be done via a feature flag or staging branch instead of directly modifying the active production component.
