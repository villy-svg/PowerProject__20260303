---
description: Standards for creating Implementation Plans, including the requirement to write a Product Plan.
---

# Implementation Planning Standards

When creating an `implementation_plan.md` artifact (or any similar plan), you MUST include both a **Product Plan** and a **Technical Implementation Plan**.

## 1. Product Plan
Before diving into technical details, clearly outline the product perspective. This section should include:
- **User Personas & Use Cases**: Who is this for, and what problem does it solve for them?
- **User Flows / Experience**: How will the user interact with this new feature or change? What does the UI/UX look like from a high level?
- **Feature Scope**: What are the core features being delivered? What is explicitly out of scope for this iteration?
- **Success Criteria**: How do we know this feature is successful from a user's perspective?

## 2. Technical Implementation Plan
Following the Product Plan, provide the technical details as usual:
- Architecture and design choices.
- Files to be modified, created, or deleted (using the standard `[NEW]`, `[MODIFY]`, `[DELETE]` tags).
- Database schema changes.
- Open questions and verification plans.

**Rule:** Never provide only the technical details. Always ground the technical plan in a solid product foundation first.
