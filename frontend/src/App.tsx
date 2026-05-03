import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import CLIPage from './pages/CLIPage';
import ClaudeBPage from './pages/ClaudeBPage';
import InboxPage from './pages/InboxPage';
import SetupPage from './pages/SetupPage';
import TelemetryPage from './pages/TelemetryPage';
import { setupService } from './services/telemetryService';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/sessions" replace />;
  return <>{children}</>;
}

/**
 * Setup gate. Pings /api/v1/setup/status; if the database has zero
 * users, every route except /setup and /telemetry redirects there.
 * Runs once on mount and is cheap (no auth needed).
 */
function SetupGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const status = useQuery({
    queryKey: ['setup-status'],
    queryFn: setupService.status,
    staleTime: 60_000,
    retry: 0,
  });

  // While the probe is in flight, render children (don't flash a redirect).
  if (!status.data) return <>{children}</>;

  if (status.data.needsSetup && location.pathname !== '/setup' && location.pathname !== '/telemetry') {
    return <Navigate to="/setup" replace />;
  }
  if (!status.data.needsSetup && location.pathname === '/setup') {
    return <Navigate to="/sessions" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SetupGate>
          <Routes>
            {/* First-run + transparency — both reachable without auth */}
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/telemetry" element={<TelemetryPage />} />

            {/* Public auth routes */}
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

            {/* Protected routes with app shell */}
            <Route
              path="/sessions/:projectId?"
              element={<ProtectedRoute><AppLayout><CLIPage /></AppLayout></ProtectedRoute>}
            />
            <Route
              path="/claude-b"
              element={<ProtectedRoute><AppLayout><ClaudeBPage /></AppLayout></ProtectedRoute>}
            />
            <Route
              path="/inbox"
              element={<ProtectedRoute><AppLayout><InboxPage /></AppLayout></ProtectedRoute>}
            />
            <Route
              path="/settings"
              element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>}
            />

            {/* Back-compat redirects */}
            <Route path="/dashboard" element={<Navigate to="/sessions" replace />} />
            <Route path="/cli" element={<Navigate to="/sessions" replace />} />
            <Route path="/tasks" element={<Navigate to="/claude-b" replace />} />

            {/* Default */}
            <Route path="*" element={<Navigate to="/sessions" replace />} />
          </Routes>
        </SetupGate>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
