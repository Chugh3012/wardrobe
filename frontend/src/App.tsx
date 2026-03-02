import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import AddGarment from './pages/AddGarment';
import DailyUpload from './pages/DailyUpload';
import { trackPageView } from './telemetry';
import { checkAuth } from './api';

export type Page = 'dashboard' | 'catalog' | 'add' | 'upload';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);

  // Client-side auth gate: check /.auth/me and redirect to login if needed
  useEffect(() => {
    checkAuth().then((authenticated) => {
      if (!authenticated) {
        window.location.href = '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(window.location.pathname);
      } else {
        setAuthChecked(true);
      }
    });
  }, []);

  // Track page views in Application Insights (Issue #14)
  useEffect(() => {
    if (authChecked) trackPageView(page);
  }, [page, authChecked]);

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#6b7280' }}>
        Signing in…
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'catalog':   return <Catalog onAddGarment={() => setPage('add')} />;
      case 'add':       return <AddGarment onBack={() => setPage('catalog')} />;
      case 'upload':    return <DailyUpload />;
    }
  };

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  );
}
