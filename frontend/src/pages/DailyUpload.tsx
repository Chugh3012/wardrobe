import styles from './DailyUpload.module.css';

export default function DailyUpload() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Today's Outfit</h1>
        <p className={styles.subtitle}>Upload a photo to identify your outfit</p>
      </header>

      <div className={styles.uploadArea}>
        <label className={styles.photoUpload} aria-label="Upload today's outfit photo">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.hiddenInput}
            aria-label="Take or select outfit photo"
          />
          <span className={styles.uploadIcon}>📷</span>
          <span className={styles.uploadText}>Tap to take a photo</span>
          <span className={styles.uploadHint}>or choose from gallery</span>
        </label>
      </div>

      <div className={styles.instructions}>
        <h2 className={styles.instructionsTitle}>Tips for best results</h2>
        <ul className={styles.tipsList}>
          <li>📍 Stand in good lighting</li>
          <li>🖼️ Show the full outfit in frame</li>
          <li>🔲 Use a plain or neutral background if possible</li>
        </ul>
      </div>

      <div className={styles.predictionArea}>
        <p className={styles.predictionHint}>
          After uploading, we'll identify your outfit and ask you to confirm before recording a wear.
        </p>
      </div>
    </div>
  );
}
