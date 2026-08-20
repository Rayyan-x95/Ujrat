import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/shared/ui/Button';
import { Badge, ProjectStatusBadge, InvoiceStatusBadge } from '@/shared/ui/Badge';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

describe('Component Static Mapping and Exports Validation', () => {
  it('verifies Button component exports and is instantiable', () => {
    expect(Button).toBeDefined();
    expect(typeof Button).toBe('function');
  });

  it('verifies Badge component exports and is instantiable', () => {
    expect(Badge).toBeDefined();
    expect(typeof Badge).toBe('function');
  });

  it('verifies ProjectStatusBadge is exported and instantiable', () => {
    expect(ProjectStatusBadge).toBeDefined();
    expect(typeof ProjectStatusBadge).toBe('function');
  });

  it('verifies InvoiceStatusBadge is exported and instantiable', () => {
    expect(InvoiceStatusBadge).toBeDefined();
    expect(typeof InvoiceStatusBadge).toBe('function');
  });

  it('resets ErrorBoundary state when key changes upon project navigation', () => {
    const FaultyComponent: React.FC<{ shouldThrow: boolean; id: string }> = ({ shouldThrow, id }) => {
      if (shouldThrow) throw new Error('Crash in project ' + id);
      return <div>Project Content {id}</div>;
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      // First project throws
      act(() => {
        root.render(
          <ErrorBoundary key="project-details-proj-1">
            <FaultyComponent shouldThrow={true} id="proj-1" />
          </ErrorBoundary>
        );
      });

      expect(container.textContent).toContain('An unexpected error occurred');

      // Navigate to second project with new key
      act(() => {
        root.render(
          <ErrorBoundary key="project-details-proj-2">
            <FaultyComponent shouldThrow={false} id="proj-2" />
          </ErrorBoundary>
        );
      });

      expect(container.textContent).toContain('Project Content proj-2');
      expect(container.textContent).not.toContain('An unexpected error occurred');
    } finally {
      act(() => root.unmount());
      container.remove();
      spy.mockRestore();
    }
  });
});
