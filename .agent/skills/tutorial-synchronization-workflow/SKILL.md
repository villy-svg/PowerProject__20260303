---
name: tutorial-synchronization-workflow
description: Use when finalizing the code or UI for a new feature or updating an existing feature, to trigger tutorial slideshow generation and annotations.
---

# Tutorial Synchronization Workflow

## Overview & Philosophy
This skill establishes the role of the "Tutorial Manager" alongside standard development duties. In complex applications, features are only as good as the user's ability to understand and discover them. As an AI assistant, your job isn't done just because the code works and the UI renders. You must ensure the user onboarding and tutorial materials stay perfectly synchronized with the latest codebase.

This workflow ensures that whenever a new feature is finalized or an existing feature is updated, the user is systematically prompted to generate or update the tutorial steps and screenshot annotations. This guarantees that documentation never falls behind development.

---

## The Core Trigger Rule
**CRITICAL INSTRUCTION FOR ALL AGENTS:** 
Whenever you finalize code, complete a UI layout, or finish refactoring an existing user-facing feature, you MUST pause your execution and explicitly ask the user this exact question before moving on to a new task:

> **"We've finished this feature. Would you like me to generate or update the tutorial slideshow steps and annotations for it?"**

Do not make assumptions. Always ask. Wait for the user's explicit confirmation ("Yes" or "No") before proceeding.

---

## The Tutorial Manager Responsibilities
If the user responds with **"Yes"**, you must fully adopt the Tutorial Manager persona and perform the following structured steps. Your goal is to provide a "cut-and-paste" ready specification that the user can immediately use to create production-ready tutorial slideshows.

### 1. Identify and Map the Steps
Outline the exact logical steps a user must take to navigate to, interact with, and complete a task using the new or updated feature. 
- **Be granular:** Don't skip intermediate steps like opening a drawer or clicking a confirmation modal.
- **Be sequential:** Steps must flow linearly from start to finish.
- **Focus on the "Happy Path" first:** Document the primary intended use case before mentioning edge cases.

### 2. Outline Required Screenshots
Specify the exact screenshots the user needs to capture. You must provide distinct, complete guidelines for both environments:
- **Desktop View:** Describe the expected state of the master page header, sidebars, and main content area.
- **Mobile View:** Describe the expected state of the mobile layout, including navigation drawers, bottom sheets, or mobile-specific responsive stacks.

### 3. Describe Visual Annotations Detail
For each screenshot, describe *precisely* where to place visual annotations. These annotations are what make the tutorial understandable. Use these specific markers:
- 🔴 **Circles/Rectangles**: Use to highlight specific UI targets (e.g., buttons, input fields, badges, specific table rows).
- ➡️ **Arrows**: Use to guide the user's eye and indicate flow (e.g., pointing from a dropdown to the resulting filtered data).
- 💬 **Thought Boxes/Callouts**: Use to explain the context, the "why" behind an action, or to warn about a potential pitfall.
- 📝 **Captions**: Provide brief, instruction-oriented text accompanying the step. This text should be user-facing, written in a helpful and concise tone.

### 4. Specify Access Level (RBAC Integration)
Every feature in PowerProject is governed by Role-Based Access Control (RBAC). You must determine the minimum access level required to see and use this feature, so the tutorial is only shown to the correct audience.
- Specify the minimum role (e.g., "Executive", "Manager", "Staff", "External").
- Mention if the tutorial belongs in a specific Hub or Vertical menu.

---

## Handling Edge Cases
- **If the update is purely backend/invisible:** Still ask the question, but note that the tutorial might only require a text update rather than new screenshots, unless an error state or loading state UI was added.
- **If the UI completely changed:** Emphasize to the user that *all* previous screenshots for this flow must be discarded and recaptured.

---

## Example Output Format

When the user says "Yes," respond using the following strict markdown template:

### 🎬 Feature Tutorial: [Insert Feature Name]
**Access Level Required:** `[Staff | Manager | Executive | External]`
**Location:** `[e.g., Home Dashboard > Centralized Task Board]`

---

### 💻 Desktop Tutorial Steps

#### Step 1: Navigating to the Feature
* **Scenario / State**: The user is on the main Home Page. The Centralized Task Board is collapsed.
* **Screenshot Needed**: Capture the full desktop screen showing the dashboard header and the collapsed task board.
* **Annotations**:
  * 🔴 **Rectangle**: Highlighting the "Expand Tasks" toggle button.
  * 💬 **Callout**: "Click here to expand your personal task view."
* **Caption**: "To view your assigned duties, navigate to your Home Page and click the 'Expand Tasks' toggle."

#### Step 2: [Next Action]
*(Continue detailing steps...)*

---

### 📱 Mobile Tutorial Steps

#### Step 1: Accessing the Drawer
* **Scenario / State**: The user is viewing the mobile Home Layout.
* **Screenshot Needed**: Capture the viewport of the mobile device showing the top app bar.
* **Annotations**:
  * 🔴 **Circle**: Around the hamburger menu icon in the top left corner.
  * ➡️ **Arrow**: Pointing slightly inward to suggest a swipe or tap action.
* **Caption**: "On mobile devices, tap the menu icon or swipe right to open the navigation drawer and access your tasks."

#### Step 2: [Next Action]
*(Continue detailing steps...)*
