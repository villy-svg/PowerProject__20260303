---
name: Development Best Practices
description: Core best practices for development, including imports and variable matching.
---

# Development Best Practices

When writing code, adding new features, or modifying existing components, always follow these critical rules:

### 1. Core Rules
- **Verify Imports**: Whenever adding new functions, buttons, components, hooks, or elements, ensure you are bringing in the correct imports before calling or rendering them. This applies heavily to React elements, contexts, customized hooks, icons, and UI components. Missing imports cause blank screen application crashes.
- **Match Column and Variable Names**: Always ensure that variable names and database column names are matched correctly. Double-check destructured properties, prop names passed to components, and database queries. Pay distinct attention to differences between camelCase (often used in frontend) and snake_case (often used in database schemas).

### 2. State Management & Hooks
- **Isolate Business Logic:** Continue keeping Supabase data fetching and mutations inside global custom hooks (like `useEmployees`). This separates complex business logic from the UI components.
- **Optimistic UI Updates:** When a user toggles a status or updates a field, update the local React state immediately for a snappy user experience. If the Supabase request fails, automatically roll back the UI and show an error toast.

### 3. Error Handling & Edge Cases
- **Always Catch Promises:** Every asynchronous function (`async`/`await`) must be wrapped in a `try/catch` block. Unhandled promise rejections can cause silent failures or obscure React crashes.
- **Graceful Empty States:** Never assume an array of data will always exist. Always account for empty states (e.g., displaying a "No records found" graphic) or loading states (e.g., skeleton loaders or spinners) when fetching data. 

### 4. Component Architecture
- **Avoid "God Components":** If a component file exceeds 300–400 lines, it's usually a sign it should be broken down. Extract repetitive UI elements into smaller, reusable presentational components.
- **Limit Prop Drilling:** If you are passing a prop down through 3 or 4 layers of components that don't actually use that prop, it's time to utilize React Context to provide that data globally.

### 5. CSS & Design System Consistency
- **Rely on the Design System:** Don't write inline styles for colors, padding, or standard UI elements. Always use global classes (like `.halo-button` or `.master-action-btn`) and CSS variables (`var(--brand-green)`) to ensure sweeping design updates apply uniformly across the application.
- **Responsive Layouts:** Avoid hardcoded pixel widths (`width: 400px`). Rely on Flexbox, CSS Grid, and relative percentages so the application adapts elegantly to different monitor sizes.

### 6. Code Quality & Formatting
- **Destructure Early:** Destructure your props at the top of the function signature (e.g., `const EmployeeCard = ({ emp, onEdit }) =>`) instead of accessing `props.emp`. It acts as clear documentation for what the component expects.
- **Strict Equality (`===`):** Always use strict equality checks (`===`). Relying on loose equality (`==`) can lead to unpredictable type coercion bugs, especially when dealing with numeric IDs versus string IDs (e.g., `1 == "1"` is true, but `1 === "1"` is false). To debug situations where two identifiers look exactly identical but fail strict equality, use `typeof value` (e.g., `console.log(typeof id1, typeof id2)`) to verify that the mismatch isn't simply a Number vs. String issue.
