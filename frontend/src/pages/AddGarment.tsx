import { useState, useRef } from 'react';
import styles from './AddGarment.module.css';
import { getSasUrl, uploadToBlob, createGarment } from '../api';

interface AddGarmentProps {
  onBack: () => void;
}

const CATEGORIES = ['Dress', 'Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];
const MAX_PHOTOS = 8;

export default function AddGarment({ onBack }: AddGarmentProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const incoming = Array.from(selected).slice(0, MAX_PHOTOS - files.length);
    const merged = [...files, ...incoming].slice(0, MAX_PHOTOS);
    setFiles(merged);
    setPreviews(merged.map((f) => URL.createObjectURL(f)));
    setError(null);
  };

  const removePhoto = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) { setError('Please add at least one photo.'); return; }
    if (!name.trim()) { setError('Please enter a garment name.'); return; }
    if (!category) { setError('Please select a category.'); return; }

    setSaving(true);
    setError(null);
    try {
      // Upload each photo to blob storage via SAS URL
      const readUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const blobName = `garments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const sas = await getSasUrl(blobName, file.type || 'image/jpeg');
        await uploadToBlob(sas.uploadUrl, file);
        readUrls.push(sas.readUrl.split('?')[0]);
      }
      // Create garment record
      await createGarment(name.trim(), category, readUrls);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save garment.');
    } finally {
      setSaving(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.successState}>
          <span className={styles.successIcon}>✅</span>
          <p className={styles.successText}>Garment saved!</p>
          <button className={styles.submitButton} onClick={onBack}>
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
          <span aria-hidden="true">‹</span>
        </button>
        <h1 className={styles.title}>Add Garment</h1>
        <div className={styles.headerSpacer} />
      </header>

      {error && <p className={styles.formError}>{error}</p>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.photoSection}>
          <p className={styles.photoHint}>
            📸 Add 1–8 photos for best recognition. Use good lighting, plain background, full view.
          </p>

          {previews.length > 0 && (
            <div className={styles.previewGrid}>
              {previews.map((src, i) => (
                <div key={i} className={styles.previewItem}>
                  <img src={src} alt={`Photo ${i + 1}`} className={styles.previewImage} />
                  <button
                    type="button"
                    className={styles.removePhoto}
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length < MAX_PHOTOS && (
            <label className={styles.photoUpload} aria-label="Upload garment photos">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className={styles.hiddenInput}
                aria-label="Select up to 8 garment photos"
                onChange={handleFiles}
              />
              <span className={styles.photoUploadIcon}>📷</span>
              <span>Tap to add photos ({files.length}/{MAX_PHOTOS})</span>
            </label>
          )}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="garment-category">Category</label>
          <select
            id="garment-category"
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            aria-required="true"
          >
            <option value="" disabled>Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c.toLowerCase()}>{c}</option>
            ))}
          </select>
        </div>

        <button type="submit" className={styles.submitButton} disabled={saving}>
          {saving ? 'Saving…' : 'Save Garment'}
        </button>
      </form>
    </div>
  );
}
