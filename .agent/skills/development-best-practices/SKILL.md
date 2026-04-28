---
name: Development Best Practices
description: MANDATORY RULES for all development tasks. Enforces STRICT MODULARITY, component union refactoring, variable matching, and architecture standards. Use this heavily.
---

# Development Best Practices

When writing code, adding new features, or modifying existing components, always follow these critical rules:

### 1. Core Rules
- **Verify Imports**: Whenever adding new functions, buttons, components, hooks, or elements, ensure you are bringing in the correct imports before calling or rendering them. This applies heavily to React elements, contexts, customized hooks, icons, and UI components. Missing imports cause blank screen application crashes.
- **Match Column and Variable Names**: Always ensure that variable names and database column names are matched correctly. Double-check destructured properties, prop names passed to components, and database queries. Pay distinct attention to differences between camelCase (often used in frontend) and snake_case (often used in database schemas).

### 2. State Management & Hooks
- **Isolate Business Logic:** Continue keeping Supabase data fetching and mutations inside global custom hooks (like `useEmployees`). This separates complex business logic from the UI components.
- **Optimistic UI Updates:** When a user toggles a status or updates a field, update the local React state immediately for a snappy user experience. If the Supabase request fails, automatically roll back the UI and show an error toast.
- **Stale Closures (Corner Case):** When using `useEffect` or `useCallback`, ensure all dependencies are accurately listed in the dependency array. If you are referencing state inside a `setTimeout` or event listener, use refs (`useRef`) to access the latest value without triggering infinite re-renders.
- **Race Conditions (Corner Case):** If a user rapidly clicks a toggle button multiple times, ensure the optimistic state does not desync from the backend. Use a loading state `isUpdating` to disable the button during the flight, or queue the requests.

### 3. Error Handling & Edge Cases
- **Always Catch Promises:** Every asynchronous function (`async`/`await`) must be wrapped in a `try/catch` block. Unhandled promise rejections can cause silent failures or obscure React crashes.
- **Graceful Empty States:** Never assume an array of data will always exist. Always account for empty states (e.g., displaying a "No records found" graphic) or loading states (e.g., skeleton loaders or spinners) when fetching data. 
- **Silent Failures vs Explicit Crashes (Corner Case):** Do NOT silently swallow errors. If an API fails, `console.error` it and show a toast. Only allow the UI to crash (via ErrorBoundary) if the core state is irreversibly corrupted. 

### 4. Component Architecture (STRICT MODULARITY)
- **ABSOLUTE PRIORITY ON MODULARITY**: When designing, you MUST start with modularity in mind. Either reuse existing components as much as possible, or build NEW modular components.
- **The Union Rule for Similar Components**: Whenever you find that 2 components are similar or share functionality, YOU MUST NOT DUPLICATE CODE. You must create a new modular component that absorbs the **union** of the two. 
- **Refactor Sub-Components Safely**: After creating the union component, refactor the original sub-components to use this new shared module. **CRITICAL: WE MUST NOT BREAK THINGS AS WE GOT**. This refactoring must be done while strictly maintaining all original inputs, states, behaviors, and UI fidelity.
- **Handling Prop Transformations (Corner Case):** If you are passing data down multiple levels, and intermediate components transform the data, localize the transformation in the child or use a context provider to inject the raw data directly where needed. Don't create prop-drilling nightmares.
- **"God Components" tied to specific Hooks (Corner Case):** If a massive 400-line component is tightly coupled to a single complex hook, pass the specific state slices down to smaller, dumb presentational components rather than letting the God component handle all rendering.
- **Avoid "God Components":** If a component file exceeds 300–400 lines, you MUST break it down. Extract repetitive UI elements into smaller, reusable, and highly modular presentational components.
- **Limit Prop Drilling:** If you are passing a prop down through 3 or 4 layers, utilize React Context or state management to provide data globally, keeping intermediary components modular and dumb.

### 5. CSS & Design System Consistency
- **Rely on the Design System:** Don't write inline styles for colors, padding, or standard UI elements. Always use global classes (like `.halo-button` or `.master-action-btn`) and CSS variables (`var(--brand-green)`) to ensure sweeping design updates apply uniformly across the application.
- **Responsive Layouts:** Avoid hardcoded pixel widths (`width: 400px`). Rely on Flexbox, CSS Grid, and relative percentages so the application adapts elegantly to different monitor sizes.

### 6. Code Quality & Formatting
- **Destructure Early:** Destructure your props at the top of the function signature (e.g., `const EmployeeCard = ({ emp, onEdit }) =>`) instead of accessing `props.emp`. It acts as clear documentation for what the component expects.
- **Strict Equality (`===`):** Always use strict equality checks (`===`). Relying on loose equality (`==`) can lead to unpredictable type coercion bugs, especially when dealing with numeric IDs versus string IDs (e.g., `1 == "1"` is true, but `1 === "1"` is false). To debug situations where two identifiers look exactly identical but fail strict equality, use `typeof value` (e.g., `console.log(typeof id1, typeof id2)`) to verify that the mismatch isn't simply a Number vs. String issue.
- **API Type Mismatches (Corner Case):** Be extremely careful when comparing IDs from URLs (`useParams` always returns strings) against IDs from the database (which might be numbers). Explicitly cast them before strict comparison: `Number(id) === dbId` or `String(id) === String(dbId)`.

### 7. Runtime Stability & Coding Health
- **Adopt the Zero-Crash Policy:** Before finalizing any change, always refer to the detailed [Runtime Stability & Coding Health](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/runtime-stability-and-coding-health/SKILL.md) skill.
- **Checklist Summary:**
    - **Verify All Imports:** Never assume icons or components are globally available.
    - **Avoid Optional Destructuring Crashes:** Use `const { x } = obj || {}`.
    - **Define Const/Let Before Use:** Avoid temporal dead zone errors by placing logic after declarations.
    - **Audit Truthy Renders:** Use `!!count && ...` instead of `count && ...` to avoid rendering `0`.

### 8. Advanced Composition over Inheritance (Meta/Google Scale)
- **Compound Components:** For complex UI elements (like Tabs, Accordions, or Dropdowns), use the Compound Component pattern rather than passing 20 configuration props. This creates a flexible, declarative API (e.g., `<Dropdown><Dropdown.Trigger /><Dropdown.Menu /></Dropdown>`).
- **Render Props & Inversion of Control:** When a component needs to share its internal state but leave the rendering logic to the parent, use render props (e.g., `<List renderItem={(item) => <CustomCard data={item} />} />`). This maximizes modularity.
- **Children as a First-Class Citizen:** Avoid creating monolithic components that attempt to render everything internally based on boolean flags (`showHeader`, `showFooter`, `showSidebar`). Instead, compose components by passing React nodes as `children`.

### 9. Colocation Architecture (Enterprise Standard)
- **Feature-Based Routing:** Organize code by feature or domain, not by file type. Instead of having massive global `hooks/`, `components/`, and `utils/` folders, keep them inside the feature directory (e.g., `src/features/ChargingHubs/components`).
- **The "Delete Test" Rule:** If you delete a feature, you should only have to delete a single directory. If deleting a feature requires hunting down files in 10 different global folders, your architecture has failed.
- **Colocate Types and Styles:** Keep interfaces, specific styled components, and test files immediately next to the component that uses them. Do not create global type registries unless the types are universally shared across multiple domains.

### 10. The Service & Data Fetching Layer (Clean Architecture)
- **Zero Raw Fetching in Components:** A React component MUST NEVER directly call `supabase.from()` or `fetch()`. All data access must be abstracted into a Service Layer or a Custom Hook.
- **Repository Pattern:** Create dedicated files (e.g., `employeeService.js`) that handle the exact SQL queries, formatting, and data parsing. The UI component should only know `fetchEmployees()` and receive clean, formatted data.
- **Separation of Concerns:**
    - *Presentational Components*: Only care about how things look. They receive data as props.
    - *Container/Logic Components*: Only care about how things work. They call the custom hooks and pass data down.

### 11. Advanced State Management Paradigms
- **Local vs Global State Limit:** DO NOT default to global state (Context/Redux/Zustand). Only elevate state if it is genuinely needed by multiple disjoint parts of the application. 90% of state should be localized to the component or its immediate parent.
- **Server State vs Client State:** Treat data fetched from the database (Server State) differently than UI toggles (Client State). Use caching layers (like React Query or custom SWR hooks) for Server State rather than manually stuffing it into `useState` and `useEffect` blocks.
- **Context API Performance (Corner Case):** React Context triggers a re-render on ALL consumers when the value changes. If you have a context with frequently changing data (like mouse position or active typing), split the context into two: `ValueContext` and `DispatchContext`, or use a more granular state manager to prevent massive application-wide re-renders.

### 12. Performance Optimization Techniques (NVIDIA/Anthropic Standard)
- **Memoization Rules:** Do NOT wrap every component in `React.memo()`. Only memoize components that are structurally complex and receive pure, primitive props. Memoization itself has a cost; applying it blindly degrades performance.
- **Stable References:** If you are passing an object, array, or function as a prop to a deeply nested or memoized child component, wrap it in `useMemo` or `useCallback` to preserve its reference across renders. Otherwise, the child will re-render anyway.
- **Lazy Loading & Suspense:** For heavy routes or components that are not immediately visible (like massive charts or hidden modals), use `React.lazy()` to split the code bundle, reducing initial load time.

### 13. Deep Prop Contracts & Type Safety
- **Strict Prop Validation:** If you are not using TypeScript, utilize PropTypes or JSDoc extensively to define exactly what shapes of objects a component expects.
- **Defensive Rendering:** If a component expects an array, ensure it defaults to an empty array in the parameter list: `const UserList = ({ users = [] }) => ...`. This prevents mapping over `undefined` if the parent forgets to pass the prop.
- **Opaque IDs:** Never assume an ID is safe to render mathematically. Treat all database IDs as opaque strings unless you specifically need to sort them numerically.
