import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/globalTheme.css'
import App from './App.jsx'
import { AuthProvider } from './app/contexts/AuthContext';
import { otaUpdateService } from './services/core/otaUpdateService';

// Confirm the current OTA bundle booted cleanly BEFORE any auth/network gates.
// @capgo/capacitor-updater rolls back to the previous bundle if notifyAppReady()
// is not called within appReadyTimeout (default 10s). Platform-guarded (no-op on web).
otaUpdateService.notifyAppReady();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
