# Phase 4: State Untangling & Deep Linking

## 1. Goal
Refactor individual views (like `LeaveDashboard`) to read their parameters (e.g., `employeeId`) from the URL instead of expecting them to be passed down as React props from a global parent state.

## 2. Steps

### Step 4.1: Identify Parameter Needs
Find components that currently expect an ID to be passed to them, which dictates their mode. For example:
```jsx
// BEFORE (LeaveDashboard.jsx)
export const LeaveDashboard = ({ overrideEmployeeId }) => {
  // If overrideEmployeeId is passed, show that user. 
  // Otherwise show the logged-in user.
}
```

### Step 4.2: Use `useParams` hook
Refactor these components to check the URL parameters first. If a parameter exists in the URL, use it.

```jsx
// AFTER (LeaveDashboard.jsx)
import { useParams } from 'react-router-dom';

export const LeaveDashboard = () => {
  const { employeeId: urlEmployeeId } = useParams();
  
  // Decide which ID to use based on URL presence
  const activeEmployeeId = urlEmployeeId || loggedInUserId;

  // ... rest of the component
}
```

### Step 4.3: Implement Deep Linking Buttons
Find UI elements in the app (like an employee roster list) where an Admin clicks to view an employee's leaves. Convert these `onClick` handlers to `useNavigate` calls.

```jsx
// Component: EmployeeRoster.jsx
import { useNavigate } from 'react-router-dom';

export const EmployeeRoster = ({ employees }) => {
  const navigate = useNavigate();

  const handleViewLeaves = (empId) => {
    // Navigate to the deep link route we defined in Phase 3
    navigate(`/leaves/user/${empId}`);
  };

  return (
    // ... roster map
    <button onClick={() => handleViewLeaves(emp.id)}>View Wallet</button>
  );
};
```

## 3. Validation Checklist
- `[ ]` Open a new browser tab and manually type `http://localhost:5173/leaves/user/<some-uuid>`. Does it load that user's specific wallet instantly on boot?
- `[ ]` Does navigating back and forth from the roster to the wallet via clicking maintain the correct UI state without crashing?
- `[ ]` Have all legacy `selectedEmployee` state variables been removed from the parent layout?
