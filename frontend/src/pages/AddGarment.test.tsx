/**
 * Unit tests for AddGarment.tsx — add garment page rendering, validation, and submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('./AddGarment.module.css', () => ({ default: {} }));

vi.mock('../api', () => ({
  getSasUrl: vi.fn(),
  uploadToBlob: vi.fn(),
  createGarment: vi.fn(),
}));

import AddGarment from './AddGarment';
import { getSasUrl, uploadToBlob, createGarment } from '../api';

const mockGetSasUrl = getSasUrl as ReturnType<typeof vi.fn>;
const mockUploadToBlob = uploadToBlob as ReturnType<typeof vi.fn>;
const mockCreateGarment = createGarment as ReturnType<typeof vi.fn>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Stub URL.createObjectURL so preview generation doesn't throw in jsdom. */
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

/** Create a fake image File for upload tests. */
function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['photo-data'], name, { type });
}

/** Add a file to the hidden file input. */
function addFile(file?: File): void {
  const input = screen.getByLabelText('Select up to 8 garment photos');
  fireEvent.change(input, { target: { files: [file ?? makeFile()] } });
}

/** Fill in the name field. */
function fillName(value: string): void {
  const input = screen.getByLabelText('Name');
  fireEvent.change(input, { target: { value } });
}

/** Select a category. */
function selectCategory(value: string): void {
  const select = screen.getByLabelText('Category');
  fireEvent.change(select, { target: { value } });
}

/** Configure API mocks for a successful submission flow. */
function mockSuccessfulUpload(): void {
  mockGetSasUrl.mockResolvedValue({
    blobName: 'garments/test.jpg',
    uploadUrl: 'https://blob.test/upload?sas=token',
    readUrl: 'https://blob.test/images/test.jpg?sas=token',
  });
  mockUploadToBlob.mockResolvedValue(undefined);
  mockCreateGarment.mockResolvedValue({
    id: 'g1',
    name: 'Test Garment',
    category: 'top',
    catalogImageUrls: ['https://blob.test/images/test.jpg'],
    wearCount: 0,
    createdAt: '',
    updatedAt: '',
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AddGarment', () => {
  let mockOnBack: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnBack = vi.fn<() => void>();
  });

  // ── Initial rendering ─────────────────────────────────────────────────────

  it('renders "Add Garment" title', () => {
    // Arrange & Act
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Assert
    expect(screen.getByText('Add Garment')).toBeInTheDocument();
  });

  it('renders the back button with aria-label "Back to catalog"', () => {
    // Arrange & Act
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Assert
    const backButton = screen.getByLabelText('Back to catalog');
    expect(backButton).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Act
    fireEvent.click(screen.getByLabelText('Back to catalog'));

    // Assert
    expect(mockOnBack).toHaveBeenCalledOnce();
  });

  it('renders name input with label "Name"', () => {
    // Arrange & Act
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Assert
    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('type', 'text');
  });

  it('renders category select with all 7 options plus a disabled placeholder', () => {
    // Arrange & Act
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Assert
    const select = screen.getByLabelText('Category');
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    // 1 disabled placeholder + 7 category options = 8
    expect(options).toHaveLength(8);

    // Placeholder is disabled
    expect(options[0]).toHaveTextContent('Select a category');
    expect(options[0]).toBeDisabled();

    // Verify all categories are present
    const categories = ['Dress', 'Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];
    categories.forEach((cat, i) => {
      expect(options[i + 1]).toHaveTextContent(cat);
      expect(options[i + 1]).toHaveAttribute('value', cat.toLowerCase());
    });
  });

  it('renders "Save Garment" submit button', () => {
    // Arrange & Act
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Assert
    const submitButton = screen.getByRole('button', { name: 'Save Garment' });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('renders the photo upload area with file input', () => {
    // Arrange & Act
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Assert
    const fileInput = screen.getByLabelText('Select up to 8 garment photos');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', 'image/*');
    expect(fileInput).toHaveAttribute('multiple');
  });

  // ── Photo upload interaction ──────────────────────────────────────────────

  it('shows a preview image after adding a file', () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Act
    addFile();

    // Assert
    const preview = screen.getByAltText('Photo 1');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', 'blob:mock-url');
  });

  it('shows a remove button for each uploaded photo', () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    // Act
    addFile();

    // Assert
    const removeButton = screen.getByLabelText('Remove photo 1');
    expect(removeButton).toBeInTheDocument();
  });

  it('removes a photo preview when the remove button is clicked', () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    expect(screen.getByAltText('Photo 1')).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByLabelText('Remove photo 1'));

    // Assert
    expect(screen.queryByAltText('Photo 1')).not.toBeInTheDocument();
  });

  it('revokes the object URL for a removed photo', () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();

    // Act
    fireEvent.click(screen.getByLabelText('Remove photo 1'));

    // Assert — the blob URL should be revoked via the effect cleanup
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('revokes all preview object URLs on unmount', () => {
    // Arrange
    const { unmount } = render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();

    // Act
    unmount();

    // Assert — all preview URLs should be revoked when the component unmounts
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  // ── Validation errors ─────────────────────────────────────────────────────

  it('shows "Please add at least one photo." when submitting with no files', async () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    fillName('Test Garment');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    expect(screen.getByText('Please add at least one photo.')).toBeInTheDocument();
    expect(mockGetSasUrl).not.toHaveBeenCalled();
  });

  it('shows "Please enter a garment name." when submitting with a file but empty name', async () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    selectCategory('top');

    // Act — use fireEvent.submit to bypass jsdom HTML5 required-field validation
    fireEvent.submit(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    expect(screen.getByText('Please enter a garment name.')).toBeInTheDocument();
    expect(mockGetSasUrl).not.toHaveBeenCalled();
  });

  it('shows "Please enter a garment name." when name is only whitespace', async () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('   ');
    selectCategory('top');

    // Act — use fireEvent.submit to bypass jsdom HTML5 required-field validation
    fireEvent.submit(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    expect(screen.getByText('Please enter a garment name.')).toBeInTheDocument();
    expect(mockGetSasUrl).not.toHaveBeenCalled();
  });

  it('shows "Please select a category." when submitting with file and name but no category', async () => {
    // Arrange
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test Garment');
    // category left at default (empty string)

    // Act — use fireEvent.submit to bypass jsdom HTML5 required-field validation
    fireEvent.submit(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    expect(screen.getByText('Please select a category.')).toBeInTheDocument();
    expect(mockGetSasUrl).not.toHaveBeenCalled();
  });

  it('clears a previous validation error when a new file is added', () => {
    // Arrange — trigger a validation error first (submit with all required fields
    // filled so native validation doesn't block, but no files for component validation)
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    fillName('Test');
    selectCategory('top');
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));
    expect(screen.getByText('Please add at least one photo.')).toBeInTheDocument();

    // Act — adding a file should clear the error
    addFile();

    // Assert
    expect(screen.queryByText('Please add at least one photo.')).not.toBeInTheDocument();
  });

  // ── Successful submission ─────────────────────────────────────────────────

  it('calls API functions and shows "Garment saved!" on successful submission', async () => {
    // Arrange
    mockSuccessfulUpload();
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test Garment');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    const successText = await screen.findByText('Garment saved!');
    expect(successText).toBeInTheDocument();

    expect(mockGetSasUrl).toHaveBeenCalledOnce();
    expect(mockUploadToBlob).toHaveBeenCalledOnce();
    expect(mockCreateGarment).toHaveBeenCalledOnce();
    expect(mockCreateGarment).toHaveBeenCalledWith(
      'Test Garment',
      'top',
      ['https://blob.test/images/test.jpg'],
    );
  });

  it('shows "Back to Catalog" button in success state', async () => {
    // Arrange
    mockSuccessfulUpload();
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test Garment');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    const backButton = await screen.findByText('Back to Catalog');
    expect(backButton).toBeInTheDocument();
  });

  it('calls onBack when "Back to Catalog" is clicked in success state', async () => {
    // Arrange
    mockSuccessfulUpload();
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test Garment');
    selectCategory('top');
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));
    await screen.findByText('Garment saved!');

    // Act
    fireEvent.click(screen.getByText('Back to Catalog'));

    // Assert
    expect(mockOnBack).toHaveBeenCalledOnce();
  });

  it('hides the form and shows only success state after saving', async () => {
    // Arrange
    mockSuccessfulUpload();
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test Garment');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));
    await screen.findByText('Garment saved!');

    // Assert — form elements should no longer be visible
    expect(screen.queryByText('Add Garment')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
  });

  it('trims the garment name before sending to the API', async () => {
    // Arrange
    mockSuccessfulUpload();
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('  Padded Name  ');
    selectCategory('dress');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));
    await screen.findByText('Garment saved!');

    // Assert
    expect(mockCreateGarment).toHaveBeenCalledWith(
      'Padded Name',
      'dress',
      expect.any(Array),
    );
  });

  it('uploads multiple files and passes all read URLs to createGarment', async () => {
    // Arrange — configure API to return different URLs for sequential calls
    mockGetSasUrl
      .mockResolvedValueOnce({
        blobName: 'garments/a.jpg',
        uploadUrl: 'https://blob.test/upload-a?sas=token',
        readUrl: 'https://blob.test/images/a.jpg?sas=token',
      })
      .mockResolvedValueOnce({
        blobName: 'garments/b.jpg',
        uploadUrl: 'https://blob.test/upload-b?sas=token',
        readUrl: 'https://blob.test/images/b.jpg?sas=token',
      });
    mockUploadToBlob.mockResolvedValue(undefined);
    mockCreateGarment.mockResolvedValue({
      id: 'g1', name: 'Multi', category: 'top',
      catalogImageUrls: [], wearCount: 0, createdAt: '', updatedAt: '',
    });

    render(React.createElement(AddGarment, { onBack: mockOnBack }));

    const file1 = makeFile('a.jpg');
    const file2 = makeFile('b.jpg');
    const input = screen.getByLabelText('Select up to 8 garment photos');
    fireEvent.change(input, { target: { files: [file1, file2] } });

    fillName('Multi Photo Garment');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));
    await screen.findByText('Garment saved!');

    // Assert
    expect(mockGetSasUrl).toHaveBeenCalledTimes(2);
    expect(mockUploadToBlob).toHaveBeenCalledTimes(2);
    expect(mockCreateGarment).toHaveBeenCalledWith(
      'Multi Photo Garment',
      'top',
      ['https://blob.test/images/a.jpg', 'https://blob.test/images/b.jpg'],
    );
  });

  // ── Saving state ──────────────────────────────────────────────────────────

  it('disables the submit button and shows "Saving…" while submitting', async () => {
    // Arrange — make getSasUrl return a promise we control
    let resolveSas!: (val: unknown) => void;
    mockGetSasUrl.mockReturnValue(new Promise((r) => { resolveSas = r; }));

    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert — button should be disabled and show saving text
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();

    // Cleanup — resolve to avoid act() warnings
    resolveSas({
      blobName: 'test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    mockUploadToBlob.mockResolvedValue(undefined);
    mockCreateGarment.mockResolvedValue({
      id: 'g1', name: 'Test', category: 'top',
      catalogImageUrls: [], wearCount: 0, createdAt: '', updatedAt: '',
    });
    await waitFor(() => expect(screen.queryByText('Saving…')).not.toBeInTheDocument());
  });

  // ── Error handling during submission ──────────────────────────────────────

  it('shows the error message from a thrown Error when API call fails', async () => {
    // Arrange
    mockGetSasUrl.mockRejectedValue(new Error('Network timeout'));
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    const errorText = await screen.findByText('Network timeout');
    expect(errorText).toBeInTheDocument();
  });

  it('shows fallback error "Failed to save garment." when a non-Error is thrown', async () => {
    // Arrange
    mockGetSasUrl.mockRejectedValue('string error');
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    const errorText = await screen.findByText('Failed to save garment.');
    expect(errorText).toBeInTheDocument();
  });

  it('shows error when uploadToBlob fails', async () => {
    // Arrange
    mockGetSasUrl.mockResolvedValue({
      blobName: 'test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    mockUploadToBlob.mockRejectedValue(new Error('Blob upload failed (500)'));

    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    const errorText = await screen.findByText('Blob upload failed (500)');
    expect(errorText).toBeInTheDocument();
  });

  it('shows error when createGarment fails', async () => {
    // Arrange
    mockGetSasUrl.mockResolvedValue({
      blobName: 'test.jpg',
      uploadUrl: 'https://blob.test/upload?sas=token',
      readUrl: 'https://blob.test/images/test.jpg?sas=token',
    });
    mockUploadToBlob.mockResolvedValue(undefined);
    mockCreateGarment.mockRejectedValue(new Error('Server error'));

    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));

    // Assert
    const errorText = await screen.findByText('Server error');
    expect(errorText).toBeInTheDocument();
  });

  it('re-enables the submit button after a failed submission', async () => {
    // Arrange
    mockGetSasUrl.mockRejectedValue(new Error('fail'));
    render(React.createElement(AddGarment, { onBack: mockOnBack }));
    addFile();
    fillName('Test');
    selectCategory('top');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save Garment' }));
    await screen.findByText('fail');

    // Assert — button should be re-enabled
    const button = screen.getByRole('button', { name: 'Save Garment' });
    expect(button).not.toBeDisabled();
  });
});
