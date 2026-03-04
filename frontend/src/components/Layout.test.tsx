/**
 * Unit tests for Layout.tsx — page shell that wraps content in a <main>
 * element and renders the BottomNav navigation bar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mock CSS module ──────────────────────────────────────────────────────────

vi.mock('./Layout.module.css', () => ({ default: {} }));

// ── Mock BottomNav to isolate Layout ─────────────────────────────────────────

vi.mock('./BottomNav', () => ({
  default: (props: { current: string; onNavigate: (page: string) => void }) =>
    React.createElement(
      'nav',
      {
        'data-testid': 'bottom-nav',
        'data-current': props.current,
        onClick: () => props.onNavigate('catalog'),
      },
      'MockBottomNav',
    ),
}));

import Layout from './Layout';
import type { Page } from '../App';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Layout', () => {
  let onNavigate: ReturnType<typeof vi.fn<(page: Page) => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    onNavigate = vi.fn<(page: Page) => void>();
  });

  it('renders children inside a <main> element', () => {
    // Arrange
    const childText = 'Hello, wardrobe!';

    // Act
    render(
      React.createElement(
        Layout,
        { currentPage: 'dashboard' as Page, onNavigate },
        React.createElement('p', null, childText),
      ),
    );

    // Assert
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent(childText);
  });

  it('renders multiple children inside <main>', () => {
    // Arrange & Act
    render(
      React.createElement(
        Layout,
        { currentPage: 'dashboard' as Page, onNavigate },
        React.createElement('h1', null, 'Title'),
        React.createElement('p', null, 'Body text'),
      ),
    );

    // Assert
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Title');
    expect(main).toHaveTextContent('Body text');
  });

  it('renders the BottomNav component', () => {
    // Arrange & Act
    render(
      React.createElement(
        Layout,
        { currentPage: 'catalog' as Page, onNavigate },
        React.createElement('div', null, 'page content'),
      ),
    );

    // Assert
    const nav = screen.getByTestId('bottom-nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveTextContent('MockBottomNav');
  });

  it('passes the currentPage prop to BottomNav as "current"', () => {
    // Arrange
    const page: Page = 'history';

    // Act
    render(
      React.createElement(
        Layout,
        { currentPage: page, onNavigate },
        React.createElement('div', null, 'content'),
      ),
    );

    // Assert
    const nav = screen.getByTestId('bottom-nav');
    expect(nav).toHaveAttribute('data-current', 'history');
  });

  it('forwards the onNavigate callback to BottomNav', () => {
    // Arrange
    render(
      React.createElement(
        Layout,
        { currentPage: 'dashboard' as Page, onNavigate },
        React.createElement('div', null, 'content'),
      ),
    );

    // Act — click the mocked BottomNav, which calls onNavigate('catalog')
    const nav = screen.getByTestId('bottom-nav');
    nav.click();

    // Assert
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('catalog');
  });

  it('renders BottomNav outside of <main>', () => {
    // Arrange & Act
    render(
      React.createElement(
        Layout,
        { currentPage: 'upload' as Page, onNavigate },
        React.createElement('div', null, 'content'),
      ),
    );

    // Assert — BottomNav should be a sibling of <main>, not inside it
    const main = screen.getByRole('main');
    const nav = screen.getByTestId('bottom-nav');
    expect(main).not.toContainElement(nav);
  });

  it('reflects different currentPage values in BottomNav', () => {
    const pages: Page[] = ['dashboard', 'catalog', 'add', 'upload', 'history'];

    for (const page of pages) {
      // Arrange & Act
      const { unmount } = render(
        React.createElement(
          Layout,
          { currentPage: page, onNavigate },
          React.createElement('div', null, 'content'),
        ),
      );

      // Assert
      const nav = screen.getByTestId('bottom-nav');
      expect(nav).toHaveAttribute('data-current', page);

      unmount();
    }
  });
});
