import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store';
import { authApi } from './services/api';

// Lazy-loaded pages 
import LoginPage from './components/LoginPage';
import FormListPage from './components/FormListPage';
import FormBuilderPage from './components/FormBuilder/FormBuilderPage';
import FormRendererPage from './components/FormRenderer/FormRendererPage';
import DashboardPage from './components/Dashboard/DashboardPage';

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;
  return <div className="offline-banner">Sin conexión — los envíos se guardarán localmente</div>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, setUser, logout } = useAuthStore();

  // Fetch current user on mount if we have a token 
  useEffect(() => {
    if (token) {
      authApi.getMe().then((res) => setUser(res.data)).catch(() => logout());
    }
  }, [token, setUser, logout]);

  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <FormListPage />
            </AuthGuard>
          }
        />
        <Route
          path="/builder/:formId?"
          element={
            <AuthGuard>
              <FormBuilderPage />
            </AuthGuard>
          }
        />
        <Route path="/form/:formId" element={<FormRendererPage />} />
        <Route
          path="/dashboard/:formId"
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          }
        />
      </Routes>
    </>
  );
}
