import styles from './Dashboard.module.css';

export default function Dashboard() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Wardrobe</h1>
        <p className={styles.subtitle}>Your outfit wear stats</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Overview</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>—</span>
            <span className={styles.statLabel}>Total Items</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>—</span>
            <span className={styles.statLabel}>Total Wears</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Most Worn</h2>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>👗</span>
          <p>No wear data yet.</p>
          <p className={styles.emptyHint}>Start by adding garments to your catalog.</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Least Worn</h2>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔍</span>
          <p>Add garments and track outfits to see insights here.</p>
        </div>
      </section>
    </div>
  );
}
