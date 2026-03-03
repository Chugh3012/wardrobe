import { useState } from 'react';
import styles from './DailyUpload.module.css';
import { getSasUrl, uploadToBlob, predictOutfit, confirmWear, deleteWearEvent, type PredictResponse } from '../api';

export default function DailyUpload() {
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [wearEventId, setWearEventId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setConfirmed(false);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const blobName = `outfits/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const sas = await getSasUrl(blobName, file.type || 'image/jpeg');
      await uploadToBlob(sas.uploadUrl, file);
      const prediction = await predictOutfit(sas.readUrl);
      setResult(prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to identify outfit.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async (garmentId: string) => {
    if (!result) return;
    setConfirming(true);
    setError(null);
    try {
      const wearEvent = await confirmWear(result.predictionAuditId, garmentId, true);
      setWearEventId(wearEvent.id);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record wear.');
    } finally {
      setConfirming(false);
    }
  };

  const handleRemoveOutfit = async () => {
    if (!wearEventId) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteWearEvent(wearEventId);
      resetUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove outfit.');
    } finally {
      setRemoving(false);
    }
  };

  const resetUpload = () => {
    setResult(null);
    setConfirmed(false);
    setPreview(null);
    setError(null);
    setWearEventId(null);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Today's Outfit</h1>
        <p className={styles.subtitle}>Upload a photo to identify your outfit</p>
      </header>

      {/* ── Upload area ────────────────────────────────────────────────── */}
      <div className={styles.uploadArea}>
        {preview ? (
          <div className={styles.outfitPreview}>
            <img src={preview} alt="Outfit preview" className={styles.outfitImage} />
          </div>
        ) : (
          <label className={styles.photoUpload} aria-label="Upload today's outfit photo">
            <input
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              aria-label="Take or select outfit photo"
              onChange={handleFileChange}
            />
            <span className={styles.uploadIcon}>📷</span>
            <span className={styles.uploadText}>Tap to take a photo</span>
            <span className={styles.uploadHint}>or choose from gallery</span>
          </label>
        )}
      </div>

      {/* ── Loading state ──────────────────────────────────────────────── */}
      {uploading && (
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Analyzing your outfit…</p>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────── */}
      {error && (
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={resetUpload}>Try Again</button>
        </div>
      )}

      {/* ── Prediction results ─────────────────────────────────────────── */}
      {result && !confirmed && !uploading && !error && (
        <div className={styles.predictionResults}>
          {result.confidenceLevel === 'high' ? (
            /* ── High confidence: single match + Confirm ──────────────── */
            <div className={styles.highConfidence}>
              <h2 className={styles.resultTitle}>We found a match!</h2>
              <div className={styles.matchCard}>
                <span className={styles.matchName}>{result.predictions[0].garmentName}</span>
                <span className={styles.matchConfidence}>
                  {Math.round(result.predictions[0].confidence * 100)}% confidence
                </span>
              </div>
              <button
                className={styles.confirmButton}
                onClick={() => handleConfirm(result.predictions[0].garmentId)}
                disabled={confirming}
              >
                {confirming ? 'Recording…' : '✓ Confirm'}
              </button>
              <button
                className={styles.chooseOtherButton}
                onClick={() =>
                  setResult({ ...result, confidenceLevel: 'medium' })
                }
              >
                Choose a different item
              </button>
            </div>
          ) : (
            /* ── Medium / Low confidence: top-3 choices ───────────────── */
            <div className={styles.multipleChoices}>
              <h2 className={styles.resultTitle}>
                {result.confidenceLevel === 'medium'
                  ? 'Which garment are you wearing?'
                  : 'Not sure \u2014 please select:'}
              </h2>
              <ul className={styles.choiceList}>
                {result.predictions.slice(0, 3).map((p) => (
                  <li key={p.garmentId} className={styles.choiceItem}>
                    <button
                      className={styles.choiceButton}
                      onClick={() => handleConfirm(p.garmentId)}
                      disabled={confirming}
                    >
                      <span className={styles.choiceName}>{p.garmentName}</span>
                      <span className={styles.choiceConfidence}>
                        {Math.round(p.confidence * 100)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Confirmed state ────────────────────────────────────────────── */}
      {confirmed && (
        <div className={styles.confirmedState}>
          <span className={styles.confirmedIcon}>✅</span>
          <p className={styles.confirmedText}>Wear recorded! Great outfit today.</p>
          <button className={styles.retryButton} onClick={resetUpload}>
            Upload Another
          </button>
          {wearEventId && (
            <button
              className={styles.removeButton}
              onClick={handleRemoveOutfit}
              disabled={removing}
            >
              {removing ? 'Removing…' : '🗑️ Remove This Outfit'}
            </button>
          )}
        </div>
      )}

      <div className={styles.instructions}>
        <h2 className={styles.instructionsTitle}>Tips for best results</h2>
        <ul className={styles.tipsList}>
          <li>📍 Stand in good lighting</li>
          <li>🖼️ Show the full outfit in frame</li>
          <li>🔲 Use a plain or neutral background if possible</li>
        </ul>
      </div>

      {!result && !uploading && !error && (
        <div className={styles.predictionArea}>
          <p className={styles.predictionHint}>
            After uploading, we'll identify your outfit and ask you to confirm before recording a wear.
          </p>
        </div>
      )}
    </div>
  );
}
