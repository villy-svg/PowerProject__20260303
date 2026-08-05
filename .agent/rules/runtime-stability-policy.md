# Runtime Stability & Zero-Crash Policy

This rule enforces a strict "Zero-Crash Policy" for all code modifications, aiming to eliminate "silly mistakes" that cause blank screens or runtime exceptions.

## 1. Import Integrity
- **Always Import**: Every component, icon, hook, or utility MUST be explicitly imported at the top of the file before rendering or calling it. Missing imports cause fatal `ReferenceError` crashes.

## 2. Safe Destructuring & Fallbacks
- **Never Destructure Blindly**: Do not destructure directly from object variables that can be `null` or `undefined`.
- **Use Fallbacks**: Always provide a fallback, e.g., `const { name } = user || {};` or use optional chaining `user?.name`.

## 3. Truthy Render Guards ("The 0 Bug")
- **Avoid Number Coercion**: Avoid `count && <Component />` when `count` can be `0` (which renders `0` on the screen).
- **Correct Usage**: Use explicit checks like `count > 0 && <Component />` or boolean coercion `!!count && <Component />`.

## 4. Async & Promise Safety
- **Try/Catch Everything**: Wrap every `async` function (especially API and Supabase calls) in a `try/catch` block.
- **Always Await**: Ensure all asynchronous operations are properly `await`ed. Never allow uncaught promise rejections.

## 5. Temporal Dead Zone Prevention
- **Declare Before Use**: Define all `const`/`let` variables and arrow functions above their first usage in the file to avoid hoisting errors.

## 6. Prop Name Synchronization
- **Strict Matching**: Prop names passed from parent components MUST 100% match the child component's destructured props. Pay close attention to case sensitivity.

## 7. Circular Dependencies
- **No Circular Imports**: Ensure File A does not import File B if File B already imports File A.
