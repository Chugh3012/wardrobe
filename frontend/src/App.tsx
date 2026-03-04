import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import AddGarment from './pages/AddGarment';
import DailyUpload from './pages/DailyUpload';
import History from './pages/History';
import GarmentDetail from './pages/GarmentDetail';
import { trackPageView } from './telemetry';
import { msalInstance, apiScopes } from './msalConfig';

export type Page = 'dashboard' | 'catalog' | 'add' | 'upload' | 'history' | 'garment-detail';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);

  // MSAL auth: handle redirect promise then check for logged-in accounts
  useEffect(() => {
    msalInstance
      .initialize()
      .then(() => msalInstance.handleRedirectPromise())
      .then(() => {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length === 0) {
          // No cached session — redirect to AAD login
          msalInstance.loginRedirect({ scopes: apiScopes });
        } else {
          setAuthChecked(true);
        }
      })
      .catch((err) => {
        console.error('MSAL init error', err);
        setAuthError(err?.message ?? 'Authentication failed. Please reload the page.');
      });
  }, []);

  // Track page views in Application Insights (Issue #14)
  useEffect(() => {
    if (authChecked) trackPageView(page);
  }, [page, authChecked]);

  if (authError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#dc2626', gap: '1rem', padding: '1rem', textAlign: 'center' }}>
        <div>Authentication error</div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{authError}</div>
        <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', background: 'white' }}>
          Retry
        </button>
      </div>
    );
  }

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
      case 'catalog':   return <Catalog onAddGarment={() => setPage('add')} onSelectGarment={(id) => { setSelectedGarmentId(id); setPage('garment-detail'); }} />;
      case 'add':       return <AddGarment onBack={() => setPage('catalog')} />;
      case 'upload':    return <DailyUpload />;
      case 'history':   return <History />;
      case 'garment-detail': return <GarmentDetail garmentId={selectedGarmentId!} onBack={() => setPage('catalog')} />;
    }
  };

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  );
}
