# Phase 1: Setup and Installation

## 1. Goal
Install the React Router dependency and wrap the root of the React application in the `<BrowserRouter>` context so that routing features are available globally.

## 2. Steps

### Step 2.1: Install dependency
Run the following command in the terminal to install React Router DOM:
```bash
npm install react-router-dom
```

### Step 2.2: Update main.jsx (or App.jsx)
Locate the entry point of the React application (usually `src/main.jsx` or `src/index.jsx`). 
Import `BrowserRouter` from `react-router-dom` and wrap the `<App />` component.

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

### Step 2.3: Configure Local Dev Server (Vite)
If using Vite, ensure that history fallback is enabled. Vite handles this automatically in development, but it's good to verify that navigating to a manual URL (like `http://localhost:5173/test`) doesn't throw a 404 from the server, but rather falls back to index.html.

## 3. Validation Checklist
- `[ ]` Is `react-router-dom` in `package.json`?
- `[ ]` Is the app wrapped in `<BrowserRouter>`?
- `[ ]` Does the app still boot up without errors in the console?
