import { useState, useEffect } from 'react';
import styles from './GarmentDetail.module.css';
import { fetchStatsSummary, updateGarment, deleteGarment, type GarmentStat, type GarmentUpdate } from '../api';

interface GarmentDetailProps {
  garmentId: string;
  onBack: () => void;
}

const CATEGORIES = ['Dress', 'Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];

export default function GarmentDetail({ garmentId, onBack }: GarmentDetailProps) {
  const [garment, setGarment] = useState<GarmentStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStatsSummary()
      .then((stats) => {
        if (cancelled) return;
        const found = stats.garments.find((g) => g.garmentId === garmentId);
        if (found) {
          setGarment(found);
          setError(null);
        } else {
          setError('Garment not found.');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load garment.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [garmentId]);

  const startEditing = () => {
    if (!garment) return;
    setEditName(garment.name);
    setEditCategory(garment.category);
    setSaveError(null);
    setSaveSuccess(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!garment) return;

    const updates: GarmentUpdate = {};
    const trimmedName = editName.trim();
    const trimmedCategory = editCategory.trim();

    if (trimmedName && trimmedName !== garment.name) {
      updates.name = trimmedName;
    }
    if (trimmedCategory && trimmedCategory !== garment.category) {
      updates.category = trimmedCategory;
    }

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateGarment(garmentId, updates);
      setGarment({
        ...garment,
        name: updated.name,
        category: updated.category,
      });
      setSaveSuccess(true);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update garment.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGarment(garmentId);
      onBack();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete garment.');
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
            <span aria-hidden="true">‹</span>
          </button>
          <h1 className={styles.title}>Garment Details</h1>
          <div className={styles.headerSpacer} />
        </header>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !garment) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={onBack} aria-label="Back to catalog">
            <span aria-hidden="true">‹</span>
          </button>
          <h1 className={styles.title}>Garment Details</h1>
          <div className={styles.headerSpacer} />
        </header>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error ?? 'Unable to load garment.'}</p>
          <button className={styles.actionButton} onClick={onBack}>Back to Catalog</button>
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
        <h1 className={styles.title}>{garment.name}</h1>
        <div className={styles.headerSpacer} />
      </header>

      {/* ── Success feedback ──────────────────────────────────────── */}
      {saveSuccess && (
        <p className={styles.successBanner}>Garment updated successfully.</p>
      )}

      {/* ── Category badge ────────────────────────────────────────── */}
      <div className={styles.categorySection}>
        <span className={styles.categoryBadge}>{garment.category}</span>
      </div>

      {/* ── Edit form ─────────────────────────────────────────────── */}
      {editing ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Edit Garment</h2>
          {saveError && <p className={styles.formError}>{saveError}</p>}
          <form className={styles.editForm} onSubmit={handleSave}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-name">Name</label>
              <input
                id="edit-name"
                className={styles.input}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                className={styles.select}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                required
                aria-required="true"
              >
                <option value="" disabled>Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c.toLowerCase()}>{c}</option>
                ))}
              </select>
            </div>
            <div className={styles.editActions}>
              <button type="submit" className={styles.saveButton} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" className={styles.editCancelButton} onClick={cancelEditing} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className={styles.editButtonRow}>
          <button className={styles.editButton} onClick={startEditing}>
            ✏️ Edit
          </button>
        </div>
      )}

      {/* ── Stats cards ───────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Wear Statistics</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{garment.wearCount}</span>
            <span className={styles.statLabel}>Total Wears</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValueSmall}>{formatDate(garment.lastWornDate)}</span>
            <span className={styles.statLabel}>Last Worn</span>
          </div>
        </div>
      </section>

      {/* ── Wear frequency insight ────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Insights</h2>
        <div className={styles.insightCard}>
          {garment.wearCount === 0 ? (
            <>
              <span className={styles.insightIcon}>🆕</span>
              <p className={styles.insightText}>This garment hasn't been worn yet. Upload a daily outfit to start tracking!</p>
            </>
          ) : garment.wearCount >= 10 ? (
            <>
              <span className={styles.insightIcon}>⭐</span>
              <p className={styles.insightText}>This is one of your favorites! You've worn it {garment.wearCount} times.</p>
            </>
          ) : (
            <>
              <span className={styles.insightIcon}>👍</span>
              <p className={styles.insightText}>You've worn this {garment.wearCount} time{garment.wearCount !== 1 ? 's' : ''}. Keep tracking to build your wardrobe insights!</p>
            </>
          )}
        </div>
      </section>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={onBack}>
          ← Back to Catalog
        </button>
        <button
          className={styles.deleteButton}
          onClick={() => setShowConfirm(true)}
          aria-label={`Delete ${garment.name}`}
        >
          🗑 Delete Garment
        </button>
      </div>

      {/* ── Confirmation dialog ────────────────────────────────── */}
      {showConfirm && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          onKeyDown={(e) => { if (e.key === 'Escape' && !deleting) setShowConfirm(false); }}
        >
          <div className={styles.confirmDialog}>
            <p className={styles.confirmText}>
              Are you sure you want to delete <strong>{garment.name}</strong>? This action cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteButton}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
