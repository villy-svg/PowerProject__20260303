# Architecture & Modularity Standards

These rules dictate how code should be structured, reused, and safely modified.

## 1. The Union Rule (No Code Duplication)
- **Absorb and Refactor**: If two components share similar logic or structure, DO NOT duplicate the code.
- **Create the Union**: Build a single modular component that absorbs the **union** of both components' requirements.
- **Zero Breakage**: Refactor the original sub-components to use this new modular component without breaking their original inputs or behaviors.

## 2. Eradicate God Components
- **Size Limits**: Break down any component file exceeding 300–400 lines.
- **Extraction**: Extract repetitive UI elements into smaller, reusable presentational components.

## 3. Colocation ("The Delete Test")
- **Feature-Based Routing**: Organize code by feature directory (e.g., `src/features/Clients/`).
- **The Delete Test**: If a feature is deleted, it should require deleting only a single folder, rather than hunting for files across global directories.

## 4. Service & Data Layer Separation
- **No Raw Queries in UI**: React components MUST NEVER call `supabase.from()` or `fetch()` directly.
- **Abstraction Layer**: All data access and mutations must be abstracted into global custom hooks (e.g., `useEmployees`) or dedicated service files (e.g., `employeeService.js`).

## 5. Safe Code Modification (Preservation Protocol)
- **Do No Harm**: Never overwrite large files blindly. Use targeted file replacements.
- **Preserve Context**: Do not delete existing comments, JSDoc, utility functions, or fallback logic.
- **Verify Anchors**: Ensure targeted replacements have unique preceding/succeeding lines so they anchor correctly.
