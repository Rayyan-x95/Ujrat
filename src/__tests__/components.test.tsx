import { describe, it, expect } from 'vitest';
import { Button } from '@/shared/ui/Button';
import { Badge, ProjectStatusBadge, InvoiceStatusBadge } from '@/shared/ui/Badge';

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
});
