import { test, expect, type Browser, type Page } from '@playwright/test';
import { createClient, type Session } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';

// Load environment variables from .env (root), then the SPA's frontend/.env
// for the publishable key the legacy anon var retired out of the root file.
dotenv.config();
dotenv.config({ path: 'frontend/.env', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// supabase-js persists the session under this key (see SupabaseClient settings).
const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

const TEST_EMAIL = 'portal-test@example.com';
const TEST_PASSWORD = 'password12345';

let session: Session | null = null;

// Supabase auth-js already retries transient fetch errors, but this host's
// egress to Supabase drops requests for longer than its backoff window.
async function signInWithRetry() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (!res.error) return res;
    if (attempt === 3) return res;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('unreachable');
}

// Seed the session instead of driving the login form: headless Chromium
// occasionally leaves the password POST hanging with no timeout, which made
// this spec flaky for reasons unrelated to the product.
async function openAsFreelancer(page: Page) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_STORAGE_KEY, JSON.stringify(session)] as const,
  );
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 35000 });
}

// The client portal is public: a fresh context guarantees no freelancer session.
async function openPortal(browser: Browser, token: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/portal/${token}`);
  return { page, close: () => context.close() };
}

async function clickTab(page: Page, tabName: string, isPortal = false) {
  const selector = isPortal
    ? `button[role="tab"]:has-text("${tabName}")`
    : `nav[aria-label="Project workflow"] button:has-text("${tabName}")`;
  const tabButton = page.locator(selector);
  // Project pages render a skeleton while the workspace data loads.
  await expect(tabButton).toBeVisible({ timeout: 35000 });

  let isActive = false;
  for (let i = 0; i < 5; i++) {
    await tabButton.click();
    const className = await tabButton.getAttribute('class');
    if (className && (className.includes('bg-primary-muted') || className.includes('bg-primary/10') || className.includes('text-primary'))) {
      isActive = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  expect(isActive).toBe(true);
}

// Portal tokens are hashed at rest: the raw value is mintable but never
// readable, exactly like the freelancer's share action does.
async function mintPortalToken(projectId: string): Promise<string> {
  const { randomUUID, createHash } = await import('node:crypto');
  const raw = randomUUID().replace(/-/g, '');
  const hash = createHash('sha256').update(raw).digest('hex');
  const { error } = await supabase
    .from('projects')
    .update({
      portal_token_hash: hash,
      portal_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', projectId);
  if (error) throw error;
  return raw;
}

async function projectStatus(projectId: string): Promise<string | undefined> {
  const { data } = await supabase.from('projects').select('status').eq('id', projectId).single();
  return data?.status;
}

test.describe('Invoice payment actions (reject / share) & contract draft', () => {
  // These walk one project through the product's mandatory order:
  // proposal → approved → contract → signed → invoice → paid. A failure in an
  // earlier step means later steps have nothing to act on, so mark them serial.
  test.describe.configure({ mode: 'serial' });

  let workspaceId = '';
  let projectId = '';
  let invoiceId = '';
  let portalToken = '';

  test.beforeAll(async () => {
    const { data: auth, error: authError } = await signInWithRetry();
    if (authError) throw authError;
    session = auth.session;
    const user = auth.user!;

    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('profile_id', user.id)
      .is('deleted_at', null)
      .limit(1);
    workspaceId = workspaces?.[0]?.id ?? '';
    expect(workspaceId).toBeTruthy();

    await supabase.from('workspace_settings').update({ upi_id: 'test-payout@upi' }).eq('workspace_id', workspaceId);

    const stamp = Date.now();
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: `Payment Actions Client ${stamp}`,
        company: `Payment Actions Client ${stamp}`,
        email: `payment-actions-${stamp}@example.com`,
        phone: '+1234567890',
      })
      .select()
      .single();
    if (clientErr) throw clientErr;

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        client_id: client.id,
        name: `Payment Actions Project ${stamp}`,
        budget: 50000,
      })
      .select()
      .single();
    if (projErr) throw projErr;
    projectId = project.id;
    portalToken = await mintPortalToken(projectId);
  });

  test('contract draft stays a draft and does not advance the project', async ({ page, browser }) => {
    await openAsFreelancer(page);
    await page.goto(`/projects/${projectId}`);

    // The contract tab only unlocks once the client approved the proposal.
    await clickTab(page, 'proposal');
    await page.getByLabel('Project Scope & Deliverables Outline').fill('Payment actions scope');
    await page.getByLabel('Proposal Base Pricing (INR)').fill('50000');
    await page.getByLabel('Proposed Execution Timeline').fill('3 weeks');
    await page.click('button:has-text("Share with Client")');
    await expect(page.locator('text=Proposal Sent to Client').first()).toBeVisible({ timeout: 35000 });
    expect(await projectStatus(projectId)).toBe('proposal');

    const portal = await openPortal(browser, portalToken);
    try {
      await clickTab(portal.page, 'Proposal', true);
      await portal.page.click('button:has-text("Approve Proposal")');
      await expect(portal.page.locator('text=Proposal Approved').first()).toBeVisible({ timeout: 35000 });
      expect(await projectStatus(projectId)).toBe('approved');
    } finally {
      await portal.close();
    }

    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'contract');
    await page.click('button:has-text("Save Draft")');
    await expect(page.locator('text=Contract Draft Saved').first()).toBeVisible({ timeout: 35000 });

    const { data: contract } = await supabase
      .from('contracts')
      .select('status')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();
    expect(contract?.status).toBe('draft');
    // A draft contract must not move the project on.
    expect(await projectStatus(projectId)).toBe('approved');
  });

  test('client pays in the portal, freelancer rejects it, invoice returns to unpaid', async ({ page, browser }) => {
    await openAsFreelancer(page);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'contract');
    await page.click('button:has-text("Send Contract to Client")');
    await expect(page.locator('text=Contract Shared with Client').first()).toBeVisible({ timeout: 35000 });

    const portal = await openPortal(browser, portalToken);
    try {
      // The client signs in the portal, which moves the project to contract_signed.
      await clickTab(portal.page, 'Contract', true);
      await portal.page.click('button:has-text("Type")');
      await portal.page.fill('input[placeholder="e.g. Rahul Sharma"]', 'Payment Actions Client');
      await portal.page.check('input[type="checkbox"]');
      await portal.page.click('button:has-text("Sign & Authorize Contract")');
      await expect(portal.page.locator('text=Agreement Signed').first()).toBeVisible({ timeout: 35000 });
      expect(await projectStatus(projectId)).toBe('contract_signed');

      // Now the invoice can be generated and issued.
      await page.goto(`/projects/${projectId}`);
      await clickTab(page, 'invoices');
      await page.click('button:has-text("Generate Invoice")');
      await page.click('button:has-text("Compute & Create splits")');
      await expect(page.locator('p:has-text("INV-")')).toBeVisible({ timeout: 35000 });
      await page.click('button:has-text("Issue to Client")');
      await expect(page.locator('text=Invoice Issued').first()).toBeVisible({ timeout: 35000 });

      const { data: invoice } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!invoice) throw new Error('Invoice was not created.');
      invoiceId = invoice.id;

      // The client submits the UTR in the portal.
      await portal.page.goto(`/portal/${portalToken}`);
      await clickTab(portal.page, 'Invoices', true);
      await portal.page.click(`p:has-text("${invoice.invoice_number}")`);
      const utr = String(Math.floor(100000000000 + Math.random() * 900000000000));
      await portal.page.fill('input[placeholder="e.g. 423156789012"]', utr);
      await portal.page.click('button:has-text("Submit UTR for Verification")');
      await expect(portal.page.locator('text=Payment Submitted').first()).toBeVisible({ timeout: 35000 });
    } finally {
      await portal.close();
    }

    // The freelancer rejects it from the invoices list.
    await page.goto('/invoices');
    const { data: invoiceRow } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('id', invoiceId)
      .single();
    const row = page.locator('tr', { hasText: invoiceRow!.invoice_number }).first();
    await expect(row).toBeVisible({ timeout: 35000 });
    await row.locator('button:has-text("Reject")').click();
    await expect(page.locator('text=Reject Payment Attempt').first()).toBeVisible({ timeout: 35000 });
    await page.fill('textarea', 'UTR not found in the bank statement');
    await page.click('button:has-text("Reject Payment")');
    await expect(page.locator('text=Payment Rejected').first()).toBeVisible({ timeout: 35000 });

    // The attempt is failed and the invoice is payable again.
    const { data: payment } = await supabase
      .from('payments')
      .select('status, notes')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect(payment?.status).toBe('failed');
    expect(payment?.notes).toContain('UTR not found');

    const { data: rejectedInvoice } = await supabase
      .from('invoices')
      .select('status, outstanding_balance')
      .eq('id', invoiceId)
      .single();
    expect(rejectedInvoice?.status).toBe('sent');
    expect(Number(rejectedInvoice?.outstanding_balance)).toBeGreaterThan(0);
  });

  test('share button opens a UPI link with the outstanding amount', async ({ page }) => {
    // Record what the app hands to window.open (the UPI deep link).
    await page.addInitScript(() => {
      (window as any).__openedUrls = [];
      const original = window.open;
      (window as any).open = (url?: string | URL, ...rest: any[]) => {
        (window as any).__openedUrls.push(String(url ?? ''));
        return original ? original.call(window, url as any, ...rest) : null;
      };
      // Desktop Chrome exposes the Web Share API; its OS sheet never settles
      // in headless mode, so force the app down the window.open path.
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });

    // Pick the invoice from the database so the test survives a retry.
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, outstanding_balance')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .gt('outstanding_balance', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!invoice) throw new Error('No payable invoice for the project.');

    await openAsFreelancer(page);
    await page.goto('/invoices');
    const row = page.locator('tr', { hasText: invoice.invoice_number }).first();
    await expect(row).toBeVisible({ timeout: 35000 });
    await row.locator('button:has-text("Share")').click();

    const opened = await page.evaluate(() => (window as any).__openedUrls as string[]);
    expect(opened.length).toBeGreaterThan(0);
    const upi = opened[0];
    expect(upi.startsWith('upi://pay?')).toBe(true);
    expect(upi).toContain('pa=test-payout%40upi');
    expect(upi).toContain('cu=INR');
    expect(decodeURIComponent(upi)).toContain(invoice.invoice_number);
  });

  test('partial payments settle atomically: partially_paid, then paid', async ({ page }) => {
    // The invoice under test is still unpaid here (the share test ran first).
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, total')
      .eq('id', invoiceId)
      .single();
    if (!invoice) throw new Error('Invoice missing for partial-settlement test.');
    const totalPaise = Math.round(Number(invoice.total) * 100);
    const firstPaise = Math.floor(totalPaise / 2);
    const secondPaise = totalPaise - firstPaise;

    const seedClaim = async (paise: number) => {
      const utr = String(Math.floor(100000000000 + Math.random() * 900000000000));
      const amount = paise / 100;
      const { error: attErr } = await supabase.from('payment_attempts').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        utr_number: utr,
        amount,
        status: 'pending_verification',
      });
      if (attErr) throw attErr;
      const { error: payErr } = await supabase.from('payments').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        amount,
        payment_method: 'UPI',
        transaction_reference: utr,
        status: 'pending',
      });
      if (payErr) throw payErr;
      const { error: invErr } = await supabase
        .from('invoices')
        .update({ status: 'pending_verification' })
        .eq('id', invoiceId);
      if (invErr) throw invErr;
      return utr;
    };

    const verifyFromList = async () => {
      await openAsFreelancer(page);
      await page.goto('/invoices');
      const row = page.locator('tr', { hasText: invoice!.invoice_number }).first();
      await expect(row).toBeVisible({ timeout: 35000 });
      await row.locator('button:has-text("Verify")').click();
      await expect(page.locator('text=Confirm Payment Settlement').first()).toBeVisible({ timeout: 35000 });
      await page.click('button:has-text("Confirm Payment")');
      await expect(page.locator('text=Payment Verified').first()).toBeVisible({ timeout: 35000 });
    };

    // First partial claim: exactly half the total.
    const utr1 = await seedClaim(firstPaise);
    await verifyFromList();

    const { data: partial } = await supabase
      .from('invoices')
      .select('status, outstanding_balance')
      .eq('id', invoiceId)
      .single();
    expect(partial?.status).toBe('partially_paid');
    expect(Math.round(Number(partial?.outstanding_balance) * 100)).toBe(secondPaise);

    const { data: pay1 } = await supabase
      .from('payments')
      .select('status, verifier_id')
      .eq('transaction_reference', utr1)
      .single();
    expect(pay1?.status).toBe('completed');
    expect(pay1?.verifier_id).toBeTruthy();

    // Second claim settles the remainder: the same-status balance
    // recomputation path (partially_paid -> paid) under the invoice lock.
    await seedClaim(secondPaise);
    await verifyFromList();

    const { data: settled } = await supabase
      .from('invoices')
      .select('status, outstanding_balance')
      .eq('id', invoiceId)
      .single();
    expect(settled?.status).toBe('paid');
    expect(Number(settled?.outstanding_balance)).toBe(0);

    const { data: attempts } = await supabase
      .from('payment_attempts')
      .select('status')
      .eq('invoice_id', invoiceId)
      .eq('status', 'verified');
    expect(attempts?.length).toBe(2);
  });

  test('workspace backup downloads every row and no portal token hash', async ({ page }) => {
    await openAsFreelancer(page);
    await page.goto('/settings/data');
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.click('button:has-text("Download Full Workspace Backup")');
    const download = await downloadPromise;
    const path = await download.path();
    const backup = JSON.parse(readFileSync(path!, 'utf8'));

    expect(backup.workspace_id).toBe(workspaceId);
    expect(Array.isArray(backup.projects)).toBe(true);
    // The backup must carry the workspace's own rows...
    expect(backup.projects.some((p: any) => p.id === projectId)).toBe(true);
    // ...but never the portal credential hashes.
    const projectRow = backup.projects.find((p: any) => p.id === projectId);
    expect(projectRow).not.toHaveProperty('portal_token_hash');
    expect(projectRow).not.toHaveProperty('portal_token_prev_hash');
    expect(projectRow).not.toHaveProperty('portal_token');
  });
});
