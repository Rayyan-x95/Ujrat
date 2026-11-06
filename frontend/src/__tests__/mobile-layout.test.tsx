import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MobileLayout } from '@/app/layouts/MobileLayout';
import { Input } from '@/shared/ui/Input';
import { DashboardTemplate } from '@/features/dashboard/components/DashboardTemplate';
import { ClientsTemplate } from '@/features/clients/components/ClientsTemplate';
import { ProjectsTemplate } from '@/features/projects/components/ProjectsTemplate';
import { InvoicesTemplate } from '@/features/invoices/components/InvoicesTemplate';

const testState = vi.hoisted(() => ({
  upiId: null as string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: null as any,
  navigate: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoices: [] as any[],
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => testState.navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@/features/dashboard', () => ({
  useDashboard: () => ({
    metrics: testState.metrics,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/settings', () => ({
  useWorkspaceSettings: () => ({
    settings: { upi_id: testState.upiId },
    profile: null,
    isLoading: false,
    updateSettings: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

vi.mock('@/features/clients', () => ({
  useClients: () => ({ clients: [], isLoading: false, addClient: vi.fn(), removeClient: vi.fn() }),
}));

vi.mock('@/features/projects', () => ({
  useProjects: () => ({ projects: [], isLoading: false, addProject: vi.fn() }),
}));

vi.mock('@/features/invoices', () => ({
  useInvoices: () => ({ invoices: testState.invoices, isLoading: false, payInvoice: vi.fn() }),
}));

function render(layout: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(layout);
  });
  return { container, root };
}

function cleanup(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  container.remove();
  document.body.style.overflow = '';
}

describe('MobileLayout 320px + drawer', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('bottom dock label is 56px and hidden below 360px', () => {
    const { container, root } = render(
      <MobileLayout currentView="dashboard" onViewChange={() => {}} workspaceId="ws" profileId="p">
        <div>hi</div>
      </MobileLayout>
    );
    try {
      const labels = Array.from(container.querySelectorAll('nav[aria-label="Mobile Bottom Navigation"] span')).filter(
        el => el.className.includes('text-[10px]')
      );
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.className).toContain('max-w-[56px]');
        expect(label.className).not.toContain('max-w-[64px]');
        expect(label.className).toContain('hidden');
        expect(label.className).toContain('min-[360px]:block');
      }
    } finally {
      cleanup(container, root);
    }
  });

  it('FAB is bottom-[72px] and main is pb-32', () => {
    const { container, root } = render(
      <MobileLayout currentView="dashboard" onViewChange={() => {}} workspaceId="ws" profileId="p">
        <div>hi</div>
      </MobileLayout>
    );
    try {
      expect(container.innerHTML).toContain('bottom-[72px]');
      expect(container.innerHTML).not.toContain('bottom-20');
      const main = container.querySelector('main');
      expect(main?.className).toContain('pb-32');
      expect(main?.className).not.toContain('pb-28');
    } finally {
      cleanup(container, root);
    }
  });

  it('drawer has role=dialog aria-modal, locks body, and closes on Escape', () => {
    const { container, root } = render(
      <MobileLayout currentView="dashboard" onViewChange={() => {}} workspaceId="ws" profileId="p">
        <div>hi</div>
      </MobileLayout>
    );
    try {
      const openBtn = container.querySelector('button[aria-label="Open navigation menu"]') as HTMLButtonElement;
      expect(openBtn).not.toBeNull();
      act(() => {
        openBtn.click();
      });
      const dialog = container.querySelector('aside[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(document.body.style.overflow).toBe('hidden');
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(container.querySelector('aside[role="dialog"]')).toBeNull();
      expect(document.body.style.overflow).toBe('');
    } finally {
      cleanup(container, root);
    }
  });

  it('no drawer lock when closed (baseline)', () => {
    const { container, root } = render(
      <MobileLayout currentView="dashboard" onViewChange={() => {}} workspaceId="ws" profileId="p">
        <div>hi</div>
      </MobileLayout>
    );
    try {
      expect(container.querySelector('aside[role="dialog"]')).toBeNull();
      expect(document.body.style.overflow).toBe('');
      vi.spyOn(console, 'error').mockImplementation(() => {});
    } finally {
      cleanup(container, root);
    }
  });
});

describe('Form errors + UPI readiness (Track B)', () => {
  const emptyMetrics = (over: Record<string, unknown> = {}) => ({
    profileName: 'Test User',
    activeProjects: 0,
    outstanding: 0,
    earnedThisMonth: 0,
    totalClients: 0,
    pipeline: [],
    activities: [],
    monthlyRevenue: new Array(12).fill(0),
    aging: { overdue: 0, due_7d: 0, later: 0 },
    ...over,
  });

  beforeEach(() => {
    testState.metrics = emptyMetrics();
    testState.upiId = null;
    testState.navigate.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Input marks aria-invalid with an alert when error is given', () => {
    const { container, root } = render(<Input label="Full Name" error="Name is required." />);
    try {
      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-invalid')).toBe('true');
      expect(container.querySelector('[role="alert"]')?.textContent).toBe('Name is required.');
    } finally {
      cleanup(container, root);
    }
  });

  it('Input is not invalid without an error', () => {
    const { container, root } = render(<Input label="Full Name" />);
    try {
      expect(container.querySelector('input')?.getAttribute('aria-invalid')).toBeNull();
      expect(container.querySelector('[role="alert"]')).toBeNull();
    } finally {
      cleanup(container, root);
    }
  });

  it('ClientsTemplate empty submit shows field errors and keeps the warning toast', () => {
    const addToast = vi.fn();
    const { container, root } = render(
      <ClientsTemplate workspaceId="ws" profileId="p" addToast={addToast} />
    );
    try {
      const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Add Client'));
      expect(addBtn).not.toBeUndefined();
      act(() => { addBtn?.click(); });
      const form = container.querySelector('form');
      expect(form).not.toBeNull();
      act(() => { form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      expect(container.querySelectorAll('input[aria-invalid="true"]').length).toBeGreaterThanOrEqual(2);
      expect(container.textContent).toContain('Name is required.');
      expect(container.textContent).toContain('Email is required.');
      expect(addToast).toHaveBeenCalledWith('warning', 'Validation Warning', 'Name and Email are required.');
    } finally {
      cleanup(container, root);
    }
  });

  it('ProjectsTemplate empty submit shows field errors and keeps the warning toast', () => {
    const addToast = vi.fn();
    const { container, root } = render(
      <ProjectsTemplate workspaceId="ws" profileId="p" onSelectProject={() => {}} addToast={addToast} />
    );
    try {
      const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('New Project'));
      expect(addBtn).not.toBeUndefined();
      act(() => { addBtn?.click(); });
      const form = container.querySelector('form');
      expect(form).not.toBeNull();
      act(() => { form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      expect(container.querySelectorAll('input[aria-invalid="true"]').length).toBeGreaterThanOrEqual(1);
      expect(container.querySelector('select[aria-invalid="true"]')).not.toBeNull();
      expect(container.textContent).toContain('Project name is required.');
      expect(container.textContent).toContain('Client selection is required.');
      expect(addToast).toHaveBeenCalledWith('warning', 'Validation Warning', 'Project Name and Client selection are required.');
    } finally {
      cleanup(container, root);
    }
  });

  it('dashboard shows UPI banner and links to settings when upi_id is missing', () => {
    testState.upiId = null;
    const { container, root } = render(<DashboardTemplate workspaceId="ws" profileId="p" />);
    try {
      const banner = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Add UPI ID to enable QR payments'));
      expect(banner).not.toBeUndefined();
      act(() => { banner?.click(); });
      expect(testState.navigate).toHaveBeenCalledWith('/settings');
    } finally {
      cleanup(container, root);
    }
  });

  it('dashboard hides UPI banner when upi_id is set', () => {
    testState.upiId = 'me@upi';
    const { container, root } = render(<DashboardTemplate workspaceId="ws" profileId="p" />);
    try {
      expect(container.textContent).not.toContain('Add UPI ID to enable QR payments');
    } finally {
      cleanup(container, root);
    }
  });

  it('onboarding dismiss persists to localStorage and stays hidden', () => {
    const { container, root } = render(<DashboardTemplate workspaceId="ws" profileId="p" />);
    try {
      expect(container.textContent).toContain('Add your first Client');
      const dismiss = container.querySelector('button[title="Dismiss guide"]') as HTMLButtonElement;
      expect(dismiss).not.toBeNull();
      act(() => { dismiss.click(); });
      expect(localStorage.getItem('ujrat.onboardingDismissed')).toBe('1');
      expect(container.textContent).not.toContain('Add your first Client');
    } finally {
      cleanup(container, root);
    }

    const second = render(<DashboardTemplate workspaceId="ws" profileId="p" />);
    try {
      expect(second.container.textContent).not.toContain('Add your first Client');
    } finally {
      cleanup(second.container, second.root);
    }
  });
});

describe('Track E: FAB hide-on-scroll + 44px touch targets', () => {
  const setScrollY = (y: number) => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
  };

  afterEach(() => {
    setScrollY(0);
    testState.invoices = [];
  });

  it('FAB hides (translate-y-full) on scroll down past dock and shows on scroll up', () => {
    const { container, root } = render(
      <MobileLayout currentView="dashboard" onViewChange={() => {}} workspaceId="ws" profileId="p">
        <div>hi</div>
      </MobileLayout>
    );
    try {
      const fab = container.querySelector('[data-testid="fab-container"]');
      expect(fab).not.toBeNull();
      expect(fab?.className).not.toContain('translate-y-full');
      expect(fab?.className).toContain('bottom-[72px]');
      setScrollY(200);
      expect(container.querySelector('[data-testid="fab-container"]')?.className).toContain('translate-y-full');
      setScrollY(40);
      expect(container.querySelector('[data-testid="fab-container"]')?.className).not.toContain('translate-y-full');
    } finally {
      cleanup(container, root);
    }
  });

  it('FAB main button and invoice row actions meet 44px touch targets', () => {
    const { container, root } = render(
      <MobileLayout currentView="dashboard" onViewChange={() => {}} workspaceId="ws" profileId="p">
        <div>hi</div>
      </MobileLayout>
    );
    try {
      const fabBtn = container.querySelector('button[aria-label="Quick action menu"]');
      expect(fabBtn?.className).toContain('h-12');
      expect(fabBtn?.className).toContain('w-12');
    } finally {
      cleanup(container, root);
    }

    testState.invoices = [{
      id: 'inv-1',
      invoice_number: 'INV-1',
      status: 'sent',
      invoice_date: '2026-09-01',
      due_date: '2026-09-15',
      total: 10000,
      cgst: 0,
      sgst: 0,
      igst: 0,
      projects: null,
    }];
    const inv = render(
      <InvoicesTemplate workspaceId="ws" profileId="p" onShowInvoiceDetail={() => {}} addToast={() => {}} />
    );
    try {
      const rowBtns = Array.from(inv.container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Copy UPI ID') || b.textContent?.includes('WhatsApp') || b.textContent?.includes('Mark paid')
      );
      expect(rowBtns.length).toBeGreaterThan(0);
      for (const b of rowBtns) {
        expect(b.className).toContain('min-h-[44px]');
        expect(b.className).toContain('min-w-[44px]');
      }
    } finally {
      cleanup(inv.container, inv.root);
    }
  });
});
