import type { ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import type { Page } from '../App';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        {children}
      </main>
      <BottomNav current={currentPage} onNavigate={onNavigate} />
    </div>
  );
}
