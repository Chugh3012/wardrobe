/**
 * Unit tests for DailyUpload.tsx — daily outfit upload, prediction, confirmation, and removal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./DailyUpload.module.css', () => ({ default: {} }));

vi.mock('../api', () => ({
  getSasUrl: vi.fn(),
  uploadToBlob: vi.fn(),
  predictOutfit: vi.fn(),
  confirmWear: vi.fn(),
  deleteWearEvent: vi.fn(),
}));

import DailyUpload from './DailyUpload';
import { getSasUrl, uploadToBlob, predictOutfit, confirmWear, deleteWearEvent } from '../api';
import type { PredictResponse } from '../api';

const mockGetSasUrl = getSasUrl as ReturnType<typeof vi.fn>;
const mockUploadToBlob = uploadToBlob as ReturnType<typeof vi.fn>;
const mockPredictOutfit = predictOutfit as ReturnType<typeof vi.fn>;
const mockConfirmWear = confirmWear as ReturnType<typeof vi.fn>;
const mockDeleteWearEvent = deleteWearEvent as ReturnType<typeof vi.fn>;

// ── Fixtures ────────────────────────────────────────────────────────────────

const highConfidencePrediction: PredictResponse = {
  predictionAuditId: 'pa1',
  source: 'custom_vision',
  confidenceLevel: 'high',
  predictions: [{ garmentId: 'g1', garmentName: 'Blue Shirt', confidence: 0.95 }],
};

const mediumConfidencePrediction: PredictResponse = {
  predictionAuditId: 'pa2',
  source: 'embedding_fallback',
  confidenceLevel: 'medium',
  predictions: [
    { garmentId: 'g1', garmentName: 'Blue Shirt', confidence: 0.6 },
    { garmentId: 'g2', garmentName: 'Red Dress', confidence: 0.3 },
    { garmentId: 'g3', garmentName: 'Green Top', confidence: 0.1 },
  ],
};

const lowConfidencePrediction: PredictResponse = {
  predictionAuditId: 'pa3',
  source: 'embedding_fallback',
  confidenceLevel: 'low',
  predictions: [
    { garmentId: 'g4', garmentName: 'Black Jacket', confidence: 0.2 },
    { garmentId: 'g5', garmentName: 'White Tee', confidence: 0.15 },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Stub URL.createObjectURL so preview generation doesn't throw in jsdom. */
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
});

/** Configure API mocks for a successful upload → prediction flow. */
function mockSuccessfulUpload(prediction: PredictResponse = highConfidencePrediction): void {
  mockGetSasUrl.mockResolvedValue({
    blobName: 'outfits/test.jpg',
    uploadUrl: 'https://blob.test/upload?sas=token',
    readUrl: 'https://blob.test/images/test.jpg?sas=token',
  });
  mockUploadToBlob.mockResolvedValue(undefined);
  mockPredictOutfit.mockResolvedValue(prediction);
}

/** Simulate selecting a file in the upload input. */
async function uploadFile(): Promise<void> {
  const file = new File(['photo'], 'outfit.jpg', { type: 'image/jpeg' });
  const input = screen.getByLabelText('Take or select outfit photo');
  fireEvent.change(input, { target: { files: [file] } });
}

/** Upload a file and wait for the prediction results to appear. */
async function uploadAndWaitForPrediction(
  prediction: PredictResponse = highConfidencePrediction,
): Promise<void> {
  mockSuccessfulUpload(prediction);
  await uploadFile();
  // Wait for prediction UI to appear (uploading completes)
  await waitFor(() => {
    expect(screen.queryByText('Analyzing your outfit…')).not.toBeInTheDocument();
  });
}

/** Upload, get prediction, confirm the wear, and wait for confirmed state. */
async function uploadAndConfirm(): Promise<void> {
  mockConfirmWear.mockResolvedValue({
    id: 'we1',
    userId: 'u1',
    garmentId: 'g1',
    outfitImageUrl: 'https://blob.test/images/test.jpg',
    predictedGarmentId: 'g1',
    confidence: 0.95,
    confirmed: true,
    createdAt: '2025-06-01T12:00:00Z',
  });
  await uploadAndWaitForPrediction(highConfidencePrediction);
  fireEvent.click(screen.getByRole('button', { name: '✓ Confirm' }));
  await screen.findByText('Wear recorded! Great outfit today.');
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DailyUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial rendering ─────────────────────────────────────────────────────

  it('renders "Today\'s Outfit" title', () => {
    // Arrange & Act
    render(React.createElement(DailyUpload));

    // Assert
    expect(screen.getByText("Today's Outfit")).toBeInTheDocument();
  });

  it('renders file upload area with accessible label', () => {
    // Arrange & Act
    render(React.createElement(DailyUpload));

    // Assert
    const fileInput = screen.getByLabelText('Take or select outfit photo');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', 'image/*');
  });

  // ── Tips section ──────────────────────────────────────────────────────────

  it('renders tips section in initial state', () => {
    // Arrange & Act
    render(React.createElement(DailyUpload));

    // Assert
    expect(screen.getByText('Tips for best results')).toBeInTheDocument();
    expect(screen.getByText(/Stand in good lighting/)).toBeInTheDocument();
    expect(screen.getByText(/Show the full outfit in frame/)).toBeInTheDocument();
    expect(screen.getByText(/Use a plain or neutral background/)).toBeInTheDocument();
  });

  it('renders tips section alongside prediction results', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Assert — tips still visible
    expect(screen.getByText('Tips for best results')).toBeInTheDocument();
  });

  it('renders tips section in confirmed state', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndConfirm();

    // Assert — tips still visible
    expect(screen.getByText('Tips for best results')).toBeInTheDocument();
  });

  // ── Uploading / loading state ─────────────────────────────────────────────

  it('shows "Analyzing your outfit…" while upload is in progress', async () => {
    // Arrange — make getSasUrl return a promise we control so uploading stays true
    let resolveSas!: (val: unknown) => void;
    mockGetSasUrl.mockReturnValue(new Promise((r) => { resolveSas = r; }));
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();

    // Assert
    expect(screen.getByText('Analyzing your outfit…')).toBeInTheDocument();

    // Cleanup — resolve to avoid act() warnings
    mockUploadToBlob.mockResolvedValue(undefined);
    mockPredictOutfit.mockResolvedValue(highConfidencePrediction);
    resolveSas({
      blobName: 'outfits/test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    await waitFor(() => {
      expect(screen.queryByText('Analyzing your outfit…')).not.toBeInTheDocument();
    });
  });

  it('shows outfit preview image after selecting a file', async () => {
    // Arrange
    let resolveSas!: (val: unknown) => void;
    mockGetSasUrl.mockReturnValue(new Promise((r) => { resolveSas = r; }));
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();

    // Assert
    const preview = screen.getByAltText('Outfit preview');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', 'blob:mock-url');

    // Cleanup
    mockUploadToBlob.mockResolvedValue(undefined);
    mockPredictOutfit.mockResolvedValue(highConfidencePrediction);
    resolveSas({
      blobName: 'outfits/test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    await waitFor(() => {
      expect(screen.queryByText('Analyzing your outfit…')).not.toBeInTheDocument();
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it('shows error message with "Try Again" button when upload fails', async () => {
    // Arrange
    mockGetSasUrl.mockRejectedValue(new Error('Network timeout'));
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();

    // Assert
    const errorText = await screen.findByText('Network timeout');
    expect(errorText).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows fallback error when a non-Error is thrown during upload', async () => {
    // Arrange
    mockGetSasUrl.mockRejectedValue('string error');
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();

    // Assert
    const errorText = await screen.findByText('Failed to identify outfit.');
    expect(errorText).toBeInTheDocument();
  });

  it('shows error when uploadToBlob fails', async () => {
    // Arrange
    mockGetSasUrl.mockResolvedValue({
      blobName: 'outfits/test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    mockUploadToBlob.mockRejectedValue(new Error('Blob upload failed (500)'));
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();

    // Assert
    const errorText = await screen.findByText('Blob upload failed (500)');
    expect(errorText).toBeInTheDocument();
  });

  it('shows error when predictOutfit fails', async () => {
    // Arrange
    mockGetSasUrl.mockResolvedValue({
      blobName: 'outfits/test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    mockUploadToBlob.mockResolvedValue(undefined);
    mockPredictOutfit.mockRejectedValue(new Error('Prediction service unavailable'));
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();

    // Assert
    const errorText = await screen.findByText('Prediction service unavailable');
    expect(errorText).toBeInTheDocument();
  });

  it('clicking "Try Again" resets the upload state back to initial', async () => {
    // Arrange
    mockGetSasUrl.mockRejectedValue(new Error('Network timeout'));
    render(React.createElement(DailyUpload));
    await uploadFile();
    await screen.findByText('Network timeout');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    // Assert — back to initial state
    expect(screen.queryByText('Network timeout')).not.toBeInTheDocument();
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Take or select outfit photo')).toBeInTheDocument();
  });

  // ── High confidence prediction ────────────────────────────────────────────

  it('shows "We found a match!" with garment name and confidence for high confidence', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Assert
    expect(screen.getByText('We found a match!')).toBeInTheDocument();
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('95% confidence')).toBeInTheDocument();
  });

  it('shows "✓ Confirm" and "Choose a different item" buttons for high confidence', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Assert
    expect(screen.getByRole('button', { name: '✓ Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a different item' })).toBeInTheDocument();
  });

  it('calls confirmWear with correct args when "✓ Confirm" is clicked', async () => {
    // Arrange
    mockConfirmWear.mockResolvedValue({
      id: 'we1',
      userId: 'u1',
      garmentId: 'g1',
      outfitImageUrl: 'https://blob.test/images/test.jpg',
      predictedGarmentId: 'g1',
      confidence: 0.95,
      confirmed: true,
      createdAt: '2025-06-01T12:00:00Z',
    });
    render(React.createElement(DailyUpload));
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Act
    fireEvent.click(screen.getByRole('button', { name: '✓ Confirm' }));

    // Assert
    await waitFor(() => {
      expect(mockConfirmWear).toHaveBeenCalledOnce();
      expect(mockConfirmWear).toHaveBeenCalledWith('pa1', 'g1', true);
    });
  });

  it('shows "Recording…" and disables confirm button while confirming', async () => {
    // Arrange — make confirmWear return a controlled promise
    let resolveConfirm!: (val: unknown) => void;
    mockConfirmWear.mockReturnValue(new Promise((r) => { resolveConfirm = r; }));
    render(React.createElement(DailyUpload));
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Act
    fireEvent.click(screen.getByRole('button', { name: '✓ Confirm' }));

    // Assert
    const button = screen.getByRole('button', { name: 'Recording…' });
    expect(button).toBeDisabled();

    // Cleanup
    resolveConfirm({
      id: 'we1',
      userId: 'u1',
      garmentId: 'g1',
      outfitImageUrl: '',
      predictedGarmentId: 'g1',
      confidence: 0.95,
      confirmed: true,
      createdAt: '',
    });
    await waitFor(() => {
      expect(screen.queryByText('Recording…')).not.toBeInTheDocument();
    });
  });

  it('clicking "Choose a different item" switches to medium confidence view', async () => {
    // Arrange
    render(React.createElement(DailyUpload));
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Choose a different item' }));

    // Assert — should now show medium confidence UI
    expect(screen.getByText('Which garment are you wearing?')).toBeInTheDocument();
    expect(screen.queryByText('We found a match!')).not.toBeInTheDocument();
  });

  // ── Medium confidence prediction ──────────────────────────────────────────

  it('shows "Which garment are you wearing?" with up to 3 predictions for medium confidence', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndWaitForPrediction(mediumConfidencePrediction);

    // Assert
    expect(screen.getByText('Which garment are you wearing?')).toBeInTheDocument();
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Red Dress')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Green Top')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('calls confirmWear when a prediction choice is clicked in medium confidence', async () => {
    // Arrange
    mockConfirmWear.mockResolvedValue({
      id: 'we2',
      userId: 'u1',
      garmentId: 'g2',
      outfitImageUrl: '',
      predictedGarmentId: 'g2',
      confidence: 0.3,
      confirmed: true,
      createdAt: '',
    });
    render(React.createElement(DailyUpload));
    await uploadAndWaitForPrediction(mediumConfidencePrediction);

    // Act — click the second prediction (Red Dress)
    fireEvent.click(screen.getByText('Red Dress'));

    // Assert
    await waitFor(() => {
      expect(mockConfirmWear).toHaveBeenCalledOnce();
      expect(mockConfirmWear).toHaveBeenCalledWith('pa2', 'g2', true);
    });
  });

  // ── Low confidence prediction ─────────────────────────────────────────────

  it('shows "Not sure — please select:" for low confidence', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndWaitForPrediction(lowConfidencePrediction);

    // Assert
    expect(screen.getByText('Not sure — please select:')).toBeInTheDocument();
    expect(screen.getByText('Black Jacket')).toBeInTheDocument();
    expect(screen.getByText('White Tee')).toBeInTheDocument();
  });

  // ── Confirmed state ───────────────────────────────────────────────────────

  it('shows "Wear recorded!" message after confirmation', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndConfirm();

    // Assert
    expect(screen.getByText('Wear recorded! Great outfit today.')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('shows "Upload Another" button in confirmed state', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndConfirm();

    // Assert
    expect(screen.getByRole('button', { name: 'Upload Another' })).toBeInTheDocument();
  });

  it('"Upload Another" resets the state back to initial', async () => {
    // Arrange
    render(React.createElement(DailyUpload));
    await uploadAndConfirm();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Upload Another' }));

    // Assert — should be back to initial upload state
    expect(screen.queryByText('Wear recorded! Great outfit today.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Take or select outfit photo')).toBeInTheDocument();
  });

  it('shows "Remove This Outfit" button in confirmed state when wearEventId is set', async () => {
    // Arrange
    render(React.createElement(DailyUpload));

    // Act
    await uploadAndConfirm();

    // Assert
    expect(screen.getByRole('button', { name: /Remove This Outfit/ })).toBeInTheDocument();
  });

  it('"Remove This Outfit" calls deleteWearEvent and resets state', async () => {
    // Arrange
    mockDeleteWearEvent.mockResolvedValue(undefined);
    render(React.createElement(DailyUpload));
    await uploadAndConfirm();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Remove This Outfit/ }));

    // Assert
    await waitFor(() => {
      expect(mockDeleteWearEvent).toHaveBeenCalledOnce();
      expect(mockDeleteWearEvent).toHaveBeenCalledWith('we1');
    });
    // Should reset to initial state
    await waitFor(() => {
      expect(screen.queryByText('Wear recorded! Great outfit today.')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText('Take or select outfit photo')).toBeInTheDocument();
  });

  it('shows "Removing…" and disables button while removing outfit', async () => {
    // Arrange — make deleteWearEvent return a controlled promise
    let resolveDelete!: (val: unknown) => void;
    mockDeleteWearEvent.mockReturnValue(new Promise((r) => { resolveDelete = r; }));
    render(React.createElement(DailyUpload));
    await uploadAndConfirm();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Remove This Outfit/ }));

    // Assert
    const button = screen.getByRole('button', { name: 'Removing…' });
    expect(button).toBeDisabled();

    // Cleanup
    resolveDelete(undefined);
    await waitFor(() => {
      expect(screen.queryByText('Removing…')).not.toBeInTheDocument();
    });
  });

  it('shows error when deleteWearEvent fails', async () => {
    // Arrange
    mockDeleteWearEvent.mockRejectedValue(new Error('Delete failed'));
    render(React.createElement(DailyUpload));
    await uploadAndConfirm();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Remove This Outfit/ }));

    // Assert
    const errorText = await screen.findByText('Delete failed');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error when deleteWearEvent throws a non-Error', async () => {
    // Arrange
    mockDeleteWearEvent.mockRejectedValue('string error');
    render(React.createElement(DailyUpload));
    await uploadAndConfirm();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Remove This Outfit/ }));

    // Assert
    const errorText = await screen.findByText('Failed to remove outfit.');
    expect(errorText).toBeInTheDocument();
  });

  // ── Confirm wear errors ───────────────────────────────────────────────────

  it('shows error when confirmWear fails', async () => {
    // Arrange
    mockConfirmWear.mockRejectedValue(new Error('Confirm failed'));
    render(React.createElement(DailyUpload));
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Act
    fireEvent.click(screen.getByRole('button', { name: '✓ Confirm' }));

    // Assert
    const errorText = await screen.findByText('Confirm failed');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error when confirmWear throws a non-Error', async () => {
    // Arrange
    mockConfirmWear.mockRejectedValue('string error');
    render(React.createElement(DailyUpload));
    await uploadAndWaitForPrediction(highConfidencePrediction);

    // Act
    fireEvent.click(screen.getByRole('button', { name: '✓ Confirm' }));

    // Assert
    const errorText = await screen.findByText('Failed to record wear.');
    expect(errorText).toBeInTheDocument();
  });

  // ── API call verification ─────────────────────────────────────────────────

  it('calls getSasUrl, uploadToBlob, and predictOutfit in sequence on file select', async () => {
    // Arrange
    mockSuccessfulUpload();
    render(React.createElement(DailyUpload));

    // Act
    await uploadFile();
    await waitFor(() => {
      expect(screen.queryByText('Analyzing your outfit…')).not.toBeInTheDocument();
    });

    // Assert
    expect(mockGetSasUrl).toHaveBeenCalledOnce();
    expect(mockUploadToBlob).toHaveBeenCalledOnce();
    expect(mockUploadToBlob).toHaveBeenCalledWith(
      'https://blob.test/upload?sas=token',
      expect.any(File),
    );
    expect(mockPredictOutfit).toHaveBeenCalledOnce();
    expect(mockPredictOutfit).toHaveBeenCalledWith('https://blob.test/images/test.jpg?sas=token');
  });

  it('does not call any API when file input change has no files', () => {
    // Arrange
    render(React.createElement(DailyUpload));
    const input = screen.getByLabelText('Take or select outfit photo');

    // Act — trigger change with empty files
    fireEvent.change(input, { target: { files: [] } });

    // Assert
    expect(mockGetSasUrl).not.toHaveBeenCalled();
  });
});
