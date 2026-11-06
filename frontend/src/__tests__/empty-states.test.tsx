// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientsTemplate } from '@/features/clients/components/ClientsTemplate';
import { ProjectsTemplate } from '@/features/projects/components/ProjectsTemplate';

const addClientMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

// Empty lists -> Table renders the custom EmptyState.
vi.mock('@/features/clients', () => ({
  useClients: () => ({ clients: [], isLoading: false, addClient: addClientMock, removeClient: vi.fn() }),
}));
vi.mock('@/features/projects', () => ({
  useProjects: () => ({ projects: [], isLoading: false, addProject: vi.fn() }),
}));
vi.mock('@/features/invoices', () => ({
  useInvoices: () => ({ invoices: [], isLoading: false, payInvoice: vi.fn() }),
}));

// Feedback.tsx fallback icon path (the old gray box).
const DEFAULT_ICON_PATH = 'M20.25 7.5l-.625';

function render(el: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(el); });
  return { container, root };
}
const cleanup = (c: HTMLElement, r: ReturnType<typeof createRoot>) => { act(() => r.unmount()); c.remove(); };

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('empty states', () => {
  beforeEach(() => { addClientMock.mockClear().mockResolvedValue(undefined); });

  it('ClientsTemplate empty state uses Users icon (not the gray-box fallback)', () => {
    const { container, root } = render(<ClientsTemplate workspaceId="ws" profileId="p" addToast={vi.fn()} />);
    try {
      expect(container.textContent).toContain('No Clients Registered Yet');
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
      expect(container.innerHTML).not.toContain(DEFAULT_ICON_PATH);
    } finally { cleanup(container, root); }
  });

  it('ProjectsTemplate empty state uses Briefcase icon (not the gray-box fallback)', () => {
    const { container, root } = render(<ProjectsTemplate workspaceId="ws" profileId="p" onSelectProject={() => {}} addToast={vi.fn()} />);
    try {
      expect(container.textContent).toContain('No Active Projects Yet');
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
      expect(container.innerHTML).not.toContain(DEFAULT_ICON_PATH);
    } finally { cleanup(container, root); }
  });

  it('ClientsTemplate trims name/email on submit', async () => {
    const addToast = vi.fn();
    const { container, root } = render(<ClientsTemplate workspaceId="ws" profileId="p" addToast={addToast} />);
    try {
      const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Add Client'));
      act(() => { addBtn?.click(); });
      const nameInput = container.querySelector('input[placeholder="Arjun Mehta"]') as HTMLInputElement;
      const emailInput = container.querySelector('input[placeholder="arjun@company.in"]') as HTMLInputElement;
      expect(nameInput).not.toBeNull();
      expect(emailInput).not.toBeNull();
      act(() => { setInputValue(nameInput, '  Arjun Mehta  '); });
      act(() => { setInputValue(emailInput, '  arjun@company.in  '); });
      const form = container.querySelector('form');
      expect(form).not.toBeNull();
      await act(async () => { form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      expect(addClientMock).toHaveBeenCalled();
      expect(addClientMock.mock.calls[0]?.[0]).toMatchObject({ name: 'Arjun Mehta', email: 'arjun@company.in' });
    } finally { cleanup(container, root); }
  });
});
