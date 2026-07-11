# Phase 2: Shell & Layout Refactor

## 1. Goal
Convert the existing global state shell (which likely uses `activeVertical` or similar to determine what to render) into a Layout Route that utilizes React Router's `<Outlet />`.

## 2. Context
Currently, the main `App` component likely looks something like this:
```jsx
// BEFORE
return (
  <LayoutShell>
    {activeVertical === 'attendance' && <AttendanceBoard />}
    {activeVertical === 'leaves' && <LeaveDashboard />}
  </LayoutShell>
)
```
This is problematic because it ties rendering strictly to internal state.

## 3. Steps

### Step 3.1: Create a `MainLayout.jsx` Component
Extract the shell of the app (Header, Sidebar, wrapper `div`s) into a dedicated Layout component. 
Import `<Outlet>` from `react-router-dom`. The Outlet acts as a placeholder where child routes will render.

```jsx
// src/layouts/MainLayout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export const MainLayout = () => {
  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <Sidebar />
        <div className="page-content">
          {/* This is where the specific page content (Leaves, Attendance, etc.) will be injected */}
          <Outlet /> 
        </div>
      </div>
    </div>
  );
};
```

### Step 3.2: Update Navigation Components
Locate the Sidebar or Header components where the navigation buttons exist.
Change standard `<button>` elements (that call `setActiveVertical`) into React Router `<Link>` components, or use the `useNavigate` hook.

```jsx
// BEFORE
<button onClick={() => setActiveVertical('leaves')}>Leaves</button>

// AFTER
import { Link } from 'react-router-dom';
<Link to="/leaves" className="nav-button">Leaves</Link>
```

## 4. Validation Checklist
- `[ ]` Is `MainLayout` created and exporting correctly?
- `[ ]` Does `MainLayout` contain the `<Outlet />` component?
- `[ ]` Are Sidebar/Header links using `<Link>` or `useNavigate` instead of `useState` setters?
