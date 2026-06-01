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

### 2. Global Design Rules
- **Faux Interface over Standard UI**: Do NOT use standard pagination circles or generic tooltip dots unless absolutely necessary.
- **Interactive Mockups**: Instead, design fullscreen slides that act as "faux pages" (mockups of the actual app interface).
- **Glowing Dummy Buttons**: Place glowing, interactive dummy buttons on these faux pages. Tapping these buttons should trigger informational pop-ups or text explaining what the user needs to do.
- **No Text Clipping**: Ensure that thought bubble text boxes are never clipped at the screen boundaries or screenshot wrapper edges. If a hotspot is close to the left or right edges of the viewport, leverage alignment configurations (e.g. `align: 'right'` or `align: 'left'`) to shift the card body away from boundaries while keeping the pulsing indicator anchored correctly. The parent wrapper container must not have `overflow: hidden` properties that truncate overflowing overlays.

### 3. Outline Required Mockups & Elements
For each step, specify the exact mockup the user needs to design. Provide distinct, complete guidelines for both environments:
- **Desktop/Mobile Views**: Describe the expected state of the interface (e.g., headers, sidebars, bottom sheets) for both environments.
- 🔴 **Glowing Dummy Buttons**: Specify exactly where to place interactive dummy buttons over UI targets.
- 💬 **Pop-ups/Text**: Explain the informational text that appears when a dummy button is tapped.
- 📝 **Captions**: Provide brief, instruction-oriented text accompanying the step. This text should be user-facing, written in a helpful and concise tone.

### 4. Specify Access Level (RBAC Integration)
Every feature in PowerProject is governed by Role-Based Access Control (RBAC). You must determine the minimum access level required to see and use this feature, so the tutorial is only shown to the correct audience.
- Specify the minimum role (e.g., "Executive", "Manager", "Staff", "External").
- Mention if the tutorial belongs in a specific Hub or Vertical menu.

---

## Code Architecture & File Rules
To maintain strict modularity, when actually implementing or coding a new tutorial flow in the codebase:
- **Separate Config Files**: NEVER write the tutorial slides data directly inside `TutorialHub.jsx`.
- **New Files**: Always create a new, dedicated configuration file for the tutorial inside the flows directory: `src/features/tutorials/flows/<tutorialName>.js`.
- **Registration**: Register the new tutorial file in `src/features/tutorials/flows/index.js` by importing it and adding it to the `TUTORIAL_FLOWS` array.
- **Path Verification**: Ensure the tutorial uses relative paths for asset screenshots and follows the standard annotation schema (`circle` highlights, pointing `thought` bubbles, etc.).

---

## Handling Edge Cases
- **If the update is purely backend/invisible:** Still ask the question, but note that the tutorial might only require a text update rather than new mockups, unless an error state or loading state UI was added.
- **If the UI completely changed:** Emphasize to the user that *all* previous faux pages and mockups for this flow must be discarded and redesigned.

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
* **Interactive Mockup Needed**: Design a fullscreen faux page showing the dashboard header and the collapsed task board.
* **Interactive Elements**:
  * 🔴 **Glowing Dummy Button**: Placed over the "Expand Tasks" toggle button.
  * 💬 **Pop-up Text**: "Click here to expand your personal task view."
* **Caption**: "To view your assigned duties, navigate to your Home Page and click the 'Expand Tasks' toggle."

#### Step 2: [Next Action]
*(Continue detailing steps...)*

---

### 📱 Mobile Tutorial Steps

#### Step 1: Accessing the Drawer
* **Scenario / State**: The user is viewing the mobile Home Layout.
* **Interactive Mockup Needed**: Design a fullscreen faux page showing the top app bar.
* **Interactive Elements**:
  * 🔴 **Glowing Dummy Button**: Placed over the hamburger menu icon in the top left corner.
  * 💬 **Pop-up Text**: "Tap here to open the navigation drawer and access your tasks."
* **Caption**: "On mobile devices, tap the menu icon to open the navigation drawer."

#### Step 2: [Next Action]
*(Continue detailing steps...)*
