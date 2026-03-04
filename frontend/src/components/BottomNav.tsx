import type { Page } from '../App';
import styles from './BottomNav.module.css';

interface NavItem {
  page: Page;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '📊' },
  { page: 'catalog',   label: 'Catalog',   icon: '👗' },
  { page: 'upload',    label: 'Today',     icon: '📷' },
  { page: 'history',   label: 'History',   icon: '📅' },
];

interface BottomNavProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

export default function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {NAV_ITEMS.map(({ page, label, icon }) => (
        <button
          key={page}
          className={`${styles.item} ${current === page ? styles.active : ''}`}
          onClick={() => onNavigate(page)}
          aria-current={current === page ? 'page' : undefined}
          aria-label={label}
        >
          <span className={styles.icon} aria-hidden="true">{icon}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
