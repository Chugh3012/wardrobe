import { useState } from 'react';
import styles from './DailyUpload.module.css';

/** Shape of a single prediction returned by POST /api/wear/predict. */
interface Prediction {
  garmentId: string;
  garmentName: string;
  confidence: number;
}

/** Response shape from POST /api/wear/predict. */
interface PredictResponse {
  predictionAuditId: string;
  source: 'custom_vision' | 'embedding_fallback' | 'stub';
  confidenceLevel: 'high' | 'medium' | 'low';
  predictions: Prediction[];
}

export default function DailyUpload() {
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Placeholder — actual API call will be wired when the backend URL is
  // available at runtime.
  const handlePredict = () => {
    // Mock result for UI demonstration
    setResult({
      predictionAuditId: 'demo-audit',
      source: 'stub',
      confidenceLevel: 'high',
      predictions: [
        { garmentId: 'g1', garmentName: 'Blue Shirt', confidence: 0.95 },
        { garmentId: 'g2', garmentName: 'Red Dress', confidence: 0.72 },
        { garmentId: 'g3', garmentName: 'Black Jacket', confidence: 0.40 },
      ],
    });
    setConfirmed(false);
  };

  const handleConfirm = (_garmentId: string) => {
    setConfirmed(true);
  };

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
            onChange={handlePredict}
          />
          <span className={styles.uploadIcon}>📷</span>
          <span className={styles.uploadText}>Tap to take a photo</span>
          <span className={styles.uploadHint}>or choose from gallery</span>
        </label>
      </div>

      {/* ── Prediction results ─────────────────────────────────────────── */}
      {result && !confirmed && (
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
              >
                ✓ Confirm
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

      {!result && (
        <div className={styles.predictionArea}>
          <p className={styles.predictionHint}>
            After uploading, we'll identify your outfit and ask you to confirm before recording a wear.
          </p>
        </div>
      )}
    </div>
  );
}
