/**
 * Unit tests for BottomNav.tsx — bottom navigation bar rendering and interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock CSS module ──────────────────────────────────────────────────────────

vi.mock('./BottomNav.module.css', () => ({ default: {} }));

import BottomNav from './BottomNav';
import type { Page } from '../App';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BottomNav', () => {
  let onNavigate: ReturnType<typeof vi.fn<(page: Page) => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    onNavigate = vi.fn<(page: Page) => void>();
  });

  it('renders all four navigation items', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'dashboard', onNavigate }));

    // Assert
    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Catalog')).toBeInTheDocument();
    expect(screen.getByLabelText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('History')).toBeInTheDocument();
  });

  it('renders a <nav> with aria-label "Main navigation"', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'dashboard', onNavigate }));

    // Assert
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
  });

  it('marks the current page with aria-current="page"', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'catalog', onNavigate }));

    // Assert
    const activeButton = screen.getByLabelText('Catalog');
    expect(activeButton).toHaveAttribute('aria-current', 'page');
  });

  it('does NOT set aria-current on non-active items', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'catalog', onNavigate }));

    // Assert
    const inactiveButtons = ['Dashboard', 'Today', 'History'];
    for (const label of inactiveButtons) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-current');
    }
  });

  it('calls onNavigate with the correct page when a nav item is clicked', () => {
    // Arrange
    render(React.createElement(BottomNav, { current: 'dashboard', onNavigate }));

    // Act
    fireEvent.click(screen.getByLabelText('Catalog'));

    // Assert
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('catalog');
  });

  it('calls onNavigate with each respective page value', () => {
    // Arrange
    render(React.createElement(BottomNav, { current: 'dashboard', onNavigate }));

    const expectedCalls: [string, Page][] = [
      ['Dashboard', 'dashboard'],
      ['Catalog', 'catalog'],
      ['Today', 'upload'],
      ['History', 'history'],
    ];

    for (const [label, page] of expectedCalls) {
      // Act
      onNavigate.mockClear();
      fireEvent.click(screen.getByLabelText(label));

      // Assert
      expect(onNavigate).toHaveBeenCalledWith(page);
    }
  });

  it('each button has an aria-label matching its label text', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'upload', onNavigate }));

    // Assert
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);

    const expectedLabels = ['Dashboard', 'Catalog', 'Today', 'History'];
    buttons.forEach((button, index) => {
      expect(button).toHaveAttribute('aria-label', expectedLabels[index]);
    });
  });

  it('renders visible label text for each nav item', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'dashboard', onNavigate }));

    // Assert
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('renders icon emojis with aria-hidden="true"', () => {
    // Arrange & Act
    render(React.createElement(BottomNav, { current: 'dashboard', onNavigate }));

    // Assert — icons are decorative and hidden from assistive technology
    const icons = ['📊', '👗', '📷', '📅'];
    for (const icon of icons) {
      const el = screen.getByText(icon);
      expect(el).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('switches aria-current when a different page is current', () => {
    // Arrange — render with 'history' as the current page
    render(React.createElement(BottomNav, { current: 'history', onNavigate }));

    // Assert
    expect(screen.getByLabelText('History')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Dashboard')).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('Catalog')).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('Today')).not.toHaveAttribute('aria-current');
  });
});
