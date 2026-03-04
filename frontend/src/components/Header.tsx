import { msalInstance } from '../msalConfig';
import { clearApiCache } from '../api';
import styles from './Header.module.css';

/** Sign out: clear cached API data then redirect to AAD logout. */
async function handleSignOut(): Promise<void> {
  clearApiCache();
  try {
    await msalInstance.logoutRedirect();
  } catch (err: unknown) {
    console.error('Sign-out failed:', err);
  }
}

/** App header with branding and sign-out action. Visible on every page. */
export default function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.title}>Wardrobe Tracker</span>
      <button
        className={styles.signOutButton}
        onClick={handleSignOut}
        aria-label="Sign out"
      >
        Sign Out
      </button>
    </header>
  );
}
