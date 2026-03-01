import styles from './AddGarment.module.css';

interface AddGarmentProps {
  onBack: () => void;
}

const CATEGORIES = ['Dress', 'Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];

export default function AddGarment({ onBack }: AddGarmentProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
          <span aria-hidden="true">‹</span>
        </button>
        <h1 className={styles.title}>Add Garment</h1>
        <div className={styles.headerSpacer} />
      </header>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          // API integration in Issue #5
        }}
      >
        <div className={styles.photoSection}>
          <p className={styles.photoHint}>
            📸 Add 3–8 photos for best recognition. Use good lighting, plain background, full view.
          </p>
          <label className={styles.photoUpload} aria-label="Upload garment photos">
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className={styles.hiddenInput}
              aria-label="Select up to 8 garment photos"
            />
            <span className={styles.photoUploadIcon}>📷</span>
            <span>Tap to add photos</span>
          </label>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="garment-name">Name</label>
          <input
            id="garment-name"
            className={styles.input}
            type="text"
            placeholder="e.g. Red Floral Dress"
            required
            aria-required="true"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="garment-category">Category</label>
          <select id="garment-category" className={styles.select} defaultValue="" required aria-required="true">
            <option value="" disabled>Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c.toLowerCase()}>{c}</option>
            ))}
          </select>
        </div>

        <button type="submit" className={styles.submitButton}>
          Save Garment
        </button>
      </form>
    </div>
  );
}
