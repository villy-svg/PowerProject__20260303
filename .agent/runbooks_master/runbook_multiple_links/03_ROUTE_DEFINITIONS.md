# Phase 3: Route Definitions

## 1. Goal
Define the actual `<Routes>` tree inside the main `App.jsx` entry point, connecting URLs to their respective React components.

## 2. Steps

### Step 3.1: Define the Router Structure
In `App.jsx` (or wherever the main rendering logic lives), replace the conditional rendering with `<Routes>`.

Use the `MainLayout` created in Phase 2 as the parent route. All screens that should share the Sidebar/Header will be nested inside this route.

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AttendanceBoard } from './verticals/Employees/attendance/AttendanceBoard';
import { LeaveDashboard } from './features/LeaveManagement/components/LeaveDashboard';
// ... import other views

export default function App() {
  return (
    <Routes>
      {/* 
        The MainLayout route acts as a wrapper. 
        Any child route will render inside MainLayout's <Outlet /> 
      */}
      <Route element={<MainLayout />}>
        {/* Default redirect to a specific dashboard */}
        <Route path="/" element={<Navigate to="/attendance" replace />} />
        
        {/* Core Management Views */}
        <Route path="/attendance" element={<AttendanceBoard />} />
        <Route path="/leaves" element={<LeaveDashboard />} />
        
        {/* Deep link parameter routes */}
        <Route path="/leaves/user/:employeeId" element={<LeaveDashboard />} />
      </Route>
      
      {/* 
        Routes OUTSIDE the MainLayout (e.g., Login, 404 Pages) 
      */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

### Step 3.2: Clean Up App.jsx
Remove the old state variables like `const [activeVertical, setActiveVertical] = useState('home')` from `App.jsx`, as they are now governed entirely by the URL and the React Router configuration.

## 3. Validation Checklist
- `[ ]` Are all core views mapped to a `<Route>`?
- `[ ]` Does navigating to `/attendance` successfully load the Attendance Board inside the shell?
- `[ ]` Does hitting the browser "Back" button correctly unmount the current view and remount the previous one?
