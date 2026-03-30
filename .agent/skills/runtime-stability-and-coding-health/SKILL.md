---
name: Runtime Stability & Coding Health
description: Mandatory checklist for preventing "silly" coding mistakes that cause blank screens, crashes, or runtime errors.
---

# Runtime Stability & Coding Health

This skill defines a **Zero-Crash Policy**. Before finalizing any code change, you must perform a "Silly Mistake Audit" to ensure the application remains stable and functional.

## 1. The "Blank Screen" Prevention Checklist
A blank screen in React is usually caused by an uncaught runtime error during the execution of a component or a hook.

- **Import Validation**: 
    - **Rule**: Every component, icon, hook, or utility used in a file MUST be imported at the top.
    - **Detection**: Look for `ReferenceError: [Variable] is not defined`.
    - **Common Culprit**: Copy-pasting UI code from one file to another without bringing along the `lucide-react` icons or `ui` components.
- **Safe Destructuring**:
    - **Rule**: Never destructure from a variable that could be `null` or `undefined` without a fallback logic or optional chaining.
    - **Bad**: `const { name } = user;` (Crashes if user is null)
    - **Good**: `const { name } = user || {};` or `const name = user?.name;`
- **Hook Placement**:
    - **Rule**: Never call hooks (`useState`, `useEffect`, etc.) inside loops, conditions, or nested functions.
    - **Detection**: React will throw an error about the order of hooks changing.

## 2. Temporal Dead Zone & Scoping
- **Define Before Use**:
    - **Rule**: When using `const` or `let` to define functions or variables, they must be declared higher up in the file than their first usage.
    - **Hoisting Catch**: If you need a function to be available everywhere in the file, use a function declaration (`function myFunc() {}`) instead of an arrow function assigned to a `const`.
- **Reference Accuracy**:
    - **Rule**: Ensure that callback functions passed as props (e.g., `onDelete`, `onUpdate`) actually exist in the scope where they are being called.

## 3. Truthiness & JSX Rendering
- **The "0" Bug**:
    - **Rule**: Avoid `count && <Component />` if `count` can be `0`. React will render `0` on the screen.
    - **Fix**: Use `count > 0 && <Component />` or `!!count && <Component />`.
- **String/ID Mismatches**:
    - **Rule**: Database IDs are often strings in Supabase but might be treated as numbers. Always use `===` and ensure types match before filtering or find-ing.

## 4. Async/Promise Safety
- **Missing `await`**:
    - **Rule**: If a function returns a Promise, you MUST `await` it or handle it with `.then()`. Calling an async function without `await` and then trying to use its "result" will yield the Promise object itself, not the data.
- **Loading State Guardrails**:
    - **Rule**: If you are mapping over data fetched from an API, always check if the data exists first.
    - **Pattern**: `{loading ? <Loader /> : data?.map(...) || <EmptyState />}`

## 5. Prop Name Synchronization (Contract Enforcement)
- **Rule**: When adding a prop to a child component, immediately go to the parent component and ensure you are passing that prop with the **exact same name**.
- **Case Sensitivity**: `onUpdate` is NOT the same as `onupdate`.

## 6. Circular Dependencies
- **Rule**: File A should not import from File B if File B already imports from File A. This often causes "Object(...) is not a function" errors because one of the exports is undefined during initialization.

---

### Mandatory Final Check
Before submitting ANY edit:
1. "Did I add a new import for every new component/icon/hook I used?"
2. "Is there any line that might try to access a property of `null` or `undefined`?"
3. "Are the prop names passed from the parent 100% matched with the child's destructured props?"
4. "Did I use `await` on every Supabase call?"
