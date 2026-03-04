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
import styles from './App.module.css';

export type Page = 'dashboard' | 'catalog' | 'add' | 'upload' | 'history' | 'garment-detail';

/**
 * When VITE_SKIP_AUTH is "true" (local dev only), bypass MSAL entirely.
 * This is safe because:
 *  - The env var is only set in .env.local (gitignored)
 *  - Production builds never have this var
 *  - The backend still requires REQUIRE_AUTH=false + a user ID header
 * Evaluated as a function (not a constant) so tests can control it via vi.stubEnv.
 */
function isAuthSkipped(): boolean {
  return import.meta.env.VITE_SKIP_AUTH === 'true';
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [authChecked, setAuthChecked] = useState(isAuthSkipped());
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);

  // MSAL auth: handle redirect promise then check for logged-in accounts.
  // Skipped entirely when VITE_SKIP_AUTH=true (local dev with mock/proxy).
  useEffect(() => {
    if (isAuthSkipped()) return;

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
      <div className={styles.authError}>
        <div>Authentication error</div>
        <div className={styles.authErrorDetail}>{authError}</div>
        <button onClick={() => window.location.reload()} className={styles.authErrorButton}>
          Retry
        </button>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className={styles.signingIn}>
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
