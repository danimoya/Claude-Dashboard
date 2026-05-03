import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import CLIPage from './pages/CLIPage';
import ClaudeBPage from './pages/ClaudeBPage';
import InboxPage from './pages/InboxPage';

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

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Protected routes with app shell */}
          <Route
            path="/sessions/:projectId?"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CLIPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/claude-b"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ClaudeBPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <InboxPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SettingsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Back-compat redirects from the previous URL scheme */}
          <Route path="/dashboard" element={<Navigate to="/sessions" replace />} />
          <Route path="/cli" element={<Navigate to="/sessions" replace />} />
          <Route path="/tasks" element={<Navigate to="/claude-b" replace />} />

          {/* Default */}
          <Route path="*" element={<Navigate to="/sessions" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
