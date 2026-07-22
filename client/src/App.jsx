import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import ChatWidget from './components/ChatWidget';
import Landing    from './pages/Landing';
import Auth       from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard  from './pages/Dashboard';
import Profile    from './pages/Profile';
import Admin      from './pages/Admin';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-linen"><div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

// Wraps authenticated pages so ChatWidget is always available
function AuthLayout({ children }) {
  return (
    <ChatProvider>
      {children}
      <ChatWidget />
    </ChatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"           element={<Landing />} />
          <Route path="/auth"       element={<Auth />} />
          <Route path="/onboarding" element={<RequireAuth><AuthLayout><Onboarding /></AuthLayout></RequireAuth>} />
          <Route path="/dashboard"  element={<RequireAuth><AuthLayout><Dashboard /></AuthLayout></RequireAuth>} />
          <Route path="/profile"    element={<RequireAuth><AuthLayout><Profile /></AuthLayout></RequireAuth>} />
          <Route path="/admin"      element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
