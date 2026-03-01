import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import AddGarment from './pages/AddGarment';
import DailyUpload from './pages/DailyUpload';

export type Page = 'dashboard' | 'catalog' | 'add' | 'upload';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

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
