import styles from './Catalog.module.css';

interface CatalogProps {
  onAddGarment: () => void;
}

export default function Catalog({ onAddGarment }: CatalogProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Catalog</h1>
        <button className={styles.addButton} onClick={onAddGarment} aria-label="Add new garment">
          <span aria-hidden="true">+</span>
        </button>
      </header>

      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🧺</span>
        <p className={styles.emptyText}>Your catalog is empty</p>
        <p className={styles.emptyHint}>
          Add your first garment to start tracking your outfit usage.
        </p>
        <button className={styles.ctaButton} onClick={onAddGarment}>
          Add First Garment
        </button>
      </div>
    </div>
  );
}
