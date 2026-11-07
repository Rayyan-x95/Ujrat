import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const payInvoiceMock = vi.fn();
const addToastMock = vi.fn();
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
const { searchState } = vi.hoisted(() => ({
  searchState: { value: '', setSearchParams: vi.fn() },
}));
const { pdState } = vi.hoisted(() => ({
  pdState: { projectStatus: 'delivered' },
}));

const testInvoices = [
  {
    id: 'inv-1',
    invoice_number: 'INV-2026-101',
    status: 'overdue',
    invoice_date: '2026-09-01',
    due_date: '2026-09-15',
    total: 25000,
    cgst: 0,
    sgst: 0,
    igst: 0,
    project_id: 'proj-1',
    projects: null,
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-2026-102',
    status: 'sent',
    invoice_date: '2026-10-01',
    due_date: '2026-10-15',
    total: 50000,
    cgst: 0,
    sgst: 0,
    igst: 0,
    project_id: 'proj-1',
    projects: null,
  },
  {
    id: 'inv-3',
    invoice_number: 'INV-2026-103',
    status: 'paid',
    invoice_date: '2026-08-01',
    due_date: '2026-08-15',
    total: 15000,
    cgst: 0,
    sgst: 0,
    igst: 0,
    project_id: 'proj-2',
    projects: null,
  },
];

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams(searchState.value), searchState.setSearchParams],
}));

vi.mock('@/features/projects', async () => {
  const React = await import('react');
  return {
    useProjects: () => ({
      projects: [
        { id: 'proj-1', name: 'Website Redesign', budget: 50000, clients: { name: 'Acme Corp' } },
        { id: 'proj-2', name: 'Mobile App MVP', budget: 120000, clients: { name: 'Beta LLC' } },
      ],
      isLoading: false,
    }),
    useProjectDetails: () => {
      const [activeTab, setActiveTab] = React.useState('brief');
      return {
        project: {
          id: 'proj-1',
          name: 'Website Redesign',
          status: pdState.projectStatus,
          budget: 50000,
          portal_token: 'tok-123',
          proposals: [],
          contracts: [],
          clients: { name: 'Acme Corp' },
          project_briefs: [],
        },
        deliverables: [],
        invoices: [],
        emailLogs: [],
        isLoading: false,
        activeTab,
        setActiveTab,
        saveProposal: vi.fn(),
        sendProposal: vi.fn(),
        sendContract: vi.fn(),
        uploadDeliverable: vi.fn(),
        addDeliverableLink: vi.fn(),
        generateInvoice: vi.fn(),
        regeneratePortalToken: vi.fn(),
        changeStatus: vi.fn(),
      };
    },
  };
});

vi.mock('@/features/invoices', () => ({
  useInvoices: () => ({
    invoices: testInvoices,
    isLoading: false,
    payInvoice: payInvoiceMock,
  }),
}));

vi.mock('@/features/settings', () => ({
  useWorkspaceSettings: () => ({
    settings: { upi_id: 'freelancer@upi' },
    profile: null,
    isLoading: false,
    updateSettings: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

vi.mock('@/features/payments', () => ({
  useConfirmPayment: () => ({ mutateAsync: vi.fn() }),
}));

// Tokens are hashed at rest — the WhatsApp share mints a fresh link via the
// service (regenerate-to-reveal). Mock the service to resolve instantly.
const { regenerateTokenMock } = vi.hoisted(() => ({ regenerateTokenMock: vi.fn() }));
vi.mock('@/features/projects/services/ProjectService', () => ({
  ProjectService: {
    regeneratePortalToken: (...args: unknown[]) => regenerateTokenMock(...args),
  },
}));

// InvoicesTab mock mirrors the real component's gating + form-open state without backend calls.
vi.mock('@/features/invoices/components/InvoicesTab', async () => {
  const React = await import('react');
  return {
    InvoicesTab: ({ projectStatus }: { projectStatus: string }) => {
      const [show, setShow] = React.useState(false);
      const canIssue = projectStatus !== 'lead' && projectStatus !== 'proposal';
      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          { onClick: () => setShow(true), disabled: !canIssue },
          'Generate Invoice'
        ),
        show ? React.createElement('div', null, 'Invoice Specifications') : null
      );
    },
  };
});

const nullTab = () => () => null;
vi.mock('@/features/briefs/components/BriefTab', () => ({ BriefTab: nullTab() }));
vi.mock('@/features/proposals/components/ProposalTab', () => ({ ProposalTab: nullTab() }));
vi.mock('@/features/contracts/components/ContractTab', () => ({ ContractTab: nullTab() }));
vi.mock('@/features/deliverables/components/DeliverablesTab', () => ({ DeliverablesTab: nullTab() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let InvoicesTemplate: any;
beforeEach(async () => {
  vi.clearAllMocks();
  payInvoiceMock.mockResolvedValue({ id: 'inv-2' });
  const mod = await import('@/features/invoices/components/InvoicesTemplate');
  InvoicesTemplate = mod.InvoicesTemplate;
});

function clickButton(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text));
  if (!btn) throw new Error(`Button "${text}" not found`);
  act(() => {
    btn.click();
  });
  return btn;
}

describe('InvoicesTemplate money rail', () => {
  const vpa = 'freelancer@upi';
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <InvoicesTemplate
          workspaceId="ws-1"
          profileId="prof-1"
          onShowInvoiceDetail={() => {}}
          addToast={addToastMock}
        />
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows overdue chip for overdue invoices', () => {
    const overdueBadges = Array.from(container.querySelectorAll('span')).filter(s => s.textContent === 'Overdue');
    expect(overdueBadges.length).toBeGreaterThanOrEqual(2); // status badge + chip
  });

  it('copies UPI ID via navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    clickButton(container, 'Copy UPI ID');
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(writeText).toHaveBeenCalledWith(vpa);
  });

  it('share mints a fresh portal link and falls back to window.open wa.me', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    regenerateTokenMock.mockResolvedValue({ success: true, data: 'tok-fresh' });
    clickButton(container, 'Share');
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
      await new Promise(r => setTimeout(r, 0));
    });
    expect(regenerateTokenMock).toHaveBeenCalledWith('ws-1', 'proj-1');
    expect(openSpy).toHaveBeenCalled();
    const url = String(openSpy.mock.calls[0]?.[0] ?? '');
    expect(url).toContain('wa.me');
    expect(url).toContain('tok-fresh');
  });

  it('mark paid calls payInvoice', async () => {
    clickButton(container, 'Mark paid');
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(payInvoiceMock).toHaveBeenCalled();
    expect(payInvoiceMock.mock.calls[0]?.[0]).toBeDefined();
  });

  it('does not render Mark paid for already paid rows', () => {
    // 2 unpaid rows -> 2 Mark paid buttons (not 3)
    const markPaid = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Mark paid');
    expect(markPaid.length).toBe(2);
  });

  it('renders Copy UPI ID on every row', () => {
    const copies = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('Copy UPI ID'));
    expect(copies.length).toBe(3);
  });

  it('shows Create Invoice primary button next to GST Tax Report', () => {
    const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Create Invoice'));
    expect(btn).toBeDefined();
  });

  it('Create Invoice opens picker and picking a project navigates to project invoices tab', () => {
    clickButton(container, 'Create Invoice');
    expect(container.textContent).toContain('Select a Project to Generate Invoice');
    clickButton(container, 'Website Redesign');
    expect(navigateMock).toHaveBeenCalledWith('/projects/proj-1?tab=invoices&generate=true');
  });
});

describe('ProjectDetailsTemplate generate deep link', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ProjectDetailsTemplate: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    searchState.value = 'tab=invoices&generate=true';
    pdState.projectStatus = 'delivered';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const mod = await import('@/features/projects/components/ProjectDetailsTemplate');
    ProjectDetailsTemplate = mod.ProjectDetailsTemplate;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    searchState.value = '';
    searchState.setSearchParams.mockClear();
    vi.restoreAllMocks();
  });

  it('auto-opens invoice form and clears generate param', async () => {
    act(() => {
      root.render(
        <ProjectDetailsTemplate
          projectId="proj-1"
          workspaceId="ws-1"
          profileId="prof-1"
          onBack={() => {}}
          onShowInvoice={() => {}}
          addToast={addToastMock}
        />
      );
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(container.textContent).toContain('Invoice Specifications');
    expect(searchState.setSearchParams).toHaveBeenCalled();
    const [nextParams, opts] = searchState.setSearchParams.mock.calls[0] as [URLSearchParams, { replace: boolean }];
    expect(nextParams.get('generate')).toBeNull();
    expect(nextParams.get('tab')).toBe('invoices');
    expect(opts).toEqual({ replace: true });
  });

  it('respects gating: does not auto-open when project cannot issue invoices', async () => {
    pdState.projectStatus = 'lead';
    act(() => {
      root.render(
        <ProjectDetailsTemplate
          projectId="proj-1"
          workspaceId="ws-1"
          profileId="prof-1"
          onBack={() => {}}
          onShowInvoice={() => {}}
          addToast={addToastMock}
        />
      );
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(container.textContent).not.toContain('Invoice Specifications');
    const generateBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Generate Invoice'));
    expect((generateBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
