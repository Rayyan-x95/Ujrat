import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
// The legacy anon key retired from the root .env; the SPA's publishable key
// (same var name) lives in frontend/.env and is what the API-seeding here needs.
dotenv.config({ path: 'frontend/.env', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// One unique user per run — reusing a fixed email made reruns collide.
const timestamp = Date.now();
const testUserEmail = `e2e-${timestamp}@example.com`;
const testUserPassword = 'password12345';
const testUserName = 'E2E Test User';

async function signInAsTestUser(page: Page, email: string = testUserEmail, password: string = testUserPassword) {
  await page.context().clearCookies();
  try {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  } catch {
    // ignore
  }
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 35000 });
}

async function clickTab(page: any, tabName: string, isPortal = false) {
  const selector = isPortal
    ? `button[role="tab"]:has-text("${tabName}")`
    : `nav[aria-label="Project workflow"] button:has-text("${tabName}")`;
  const tabButton = page.locator(selector);
  await expect(tabButton).toBeVisible();

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

async function signUpTestUser(page: Page) {
  await page.goto('/signup');
  await page.locator('input[placeholder="e.g. Acme Designs"]').fill(testUserName);
  await page.fill('input[type="email"]', testUserEmail);
  await page.locator('input[type="password"]').first().fill(testUserPassword);
  await page.locator('input[type="password"]').last().fill(testUserPassword);
  await page.click('button[type="submit"]');
  // Signup routes to /login ("check your email" UX), not auto-dashboard.
  await page.waitForURL('**/login', { timeout: 35000 });
  await signInAsTestUser(page);
}

async function createClientViaAPI(workspaceId: string, clientData: any) {
  return supabase.from('clients').insert({
    workspace_id: workspaceId,
    ...clientData,
  }).select().single();
}

async function createProjectViaAPI(
  workspaceId: string,
  clientId: string,
  projectData: any,
) {
  return supabase.from('projects').insert({
    workspace_id: workspaceId,
    client_id: clientId,
    ...projectData,
  }).select().single();
}

async function getPortalToken(projectId: string) {
  // Tokens are hashed at rest (20261107170000): the raw value is mintable but
  // never readable. The test generates one and stores only its hash.
  const { randomUUID, createHash } = await import('node:crypto');
  const raw = randomUUID().replace(/-/g, '');
  const hash = createHash('sha256').update(raw).digest('hex');
  const { error } = await supabase
    .from('projects')
    .update({ portal_token_hash: hash, portal_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', projectId);
  if (error) throw error;
  return raw;
}

// Shared fixtures: one workspace/client/project per run, created in
// beforeAll; each test below is independently named and bisectable.
let workspaceId = '';
let clientId = '';
let projectId = '';
let portalToken = '';
let portalUrl = '';

test.describe.configure({ retries: 1 });

test.describe('Complete Freelancer Business Lifecycle', () => {
  test.beforeAll(async ({ page }) => {
    await signUpTestUser(page);

    await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testUserPassword,
    });

    const { data: { user } } = await supabase.auth.getUser();
    expect(user?.id).toBeTruthy();

    const { data: workspaces } = await supabase.from('workspaces').select('id').eq('profile_id', user!.id).is('deleted_at', null);
    workspaceId = workspaces?.[0]?.id;
    expect(workspaceId).toBeTruthy();

    await supabase
      .from('workspace_settings')
      .update({ upi_id: 'test-payout@upi' })
      .eq('workspace_id', workspaceId);

    const clientResult = await createClientViaAPI(workspaceId, {
      name: 'E2E Client Corp',
      email: `client-e2e-${timestamp}@example.com`,
      company: 'E2E Client Corp',
      phone: '+1234567890',
    });
    if (clientResult.error || !clientResult.data) throw clientResult.error || new Error('Client was not created.');
    clientId = clientResult.data.id;
    expect(clientId).toBeTruthy();

    const projectResult = await createProjectViaAPI(workspaceId, clientId, {
      name: 'E2E Test Project',
      budget: 50000,
      timeline_start: '2025-01-15',
      timeline_end: '2025-03-15',
      notes: 'E2E test project for full lifecycle',
    });
    if (projectResult.error || !projectResult.data) throw projectResult.error || new Error('Project was not created.');
    projectId = projectResult.data.id;
    expect(projectId).toBeTruthy();

    portalToken = await getPortalToken(projectId);
    expect(portalToken).toBeTruthy();
    portalUrl = `/portal/${portalToken}`;
  });

  test('proposal: freelancer shares, client approves', async ({ page }) => {
    test.setTimeout(120000);
    await signInAsTestUser(page);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'proposal');

    await page.getByLabel('Project Scope & Deliverables Outline').fill('E2E test scope: Build a dashboard with charts and exports');
    await page.getByLabel('Proposal Base Pricing (INR)').fill('50000');
    await page.getByLabel('Proposed Execution Timeline').fill('4 weeks');
    await page.click('button:has-text("Save Draft")');
    await expect(page.locator('text=Proposal Draft Saved')).toBeVisible({ timeout: 35000 });

    await page.click('button:has-text("Share with Client")');
    await expect(page.locator('text="Proposal Sent to Client"')).toBeVisible({ timeout: 35000 });

    await page.goto(portalUrl);
    await expect(page.locator('text=E2E Test Project')).toBeVisible({ timeout: 35000 });
    await clickTab(page, 'Proposal', true);
    await expect(page.locator('text=Approve Proposal')).toBeVisible();
    await page.click('button:has-text("Approve Proposal")');
    await expect(page.locator('text=Proposal Approved')).toBeVisible({ timeout: 35000 });
  });

  test('contract: freelancer publishes, client signs', async ({ page }) => {
    test.setTimeout(120000);
    await signInAsTestUser(page);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'contract');
    await page.click('button:has-text("Publish & Send Link")');
    await expect(page.locator('text=Contract Shared with Client')).toBeVisible({ timeout: 35000 });

    await page.goto(portalUrl);
    await clickTab(page, 'Contract', true);

    await page.fill('input[placeholder="Type your full legal name"], input[placeholder="e.g. Rahul Sharma"]', 'E2E Test Client');
    await page.click('button:has-text("Sign & Authorize Contract")');
    await expect(page.locator('text=Agreement Signed')).toBeVisible({ timeout: 35000 });

    const { data: contract } = await supabase.from('contracts').select('id').eq('project_id', projectId).is('deleted_at', null).single();
    expect(contract?.id).toBeTruthy();
  });

  test('invoice → payment submission → freelancer verification → paid', async ({ page }) => {
    test.setTimeout(120000);
    await signInAsTestUser(page);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("Generate Invoice")');
    await page.click('button:has-text("Compute & Create splits")');
    await expect(page.locator('p:has-text("INV-")')).toBeVisible({ timeout: 35000 });

    const { data: invoice } = await supabase.from('invoices')
      .select('id, invoice_number, total')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!invoice) throw new Error('Invoice was not created.');
    expect(invoice.id).toBeTruthy();

    await page.goto(portalUrl);
    await clickTab(page, 'Invoices', true);
    await page.click(`p:has-text("${invoice.invoice_number}")`);
    const lifecycleUtr = String(Math.floor(100000000000 + Math.random() * 900000000000));
    await page.fill('input[placeholder="12-digit UPI reference number"]', lifecycleUtr);
    await page.click('button:has-text("Verify Receipt")');
    await expect(page.locator('text=Receipt Submitted')).toBeVisible({ timeout: 35000 });

    await signInAsTestUser(page);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("View Invoice")');
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=The invoice has been transitioned to paid')).toBeVisible({ timeout: 35000 });

    const { data: paidInvoice } = await supabase.from('invoices').select('status').eq('id', invoice.id).single();
    expect(paidInvoice?.status).toBe('paid');
  });

  test('deliverables: upload while paid, client can download', async ({ page }) => {
    test.setTimeout(120000);
    await signInAsTestUser(page);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'deliverables');

    // If the deliverables tab is locked, click Activate Project Work first
    const activateBtn = page.locator('button:has-text("Activate Project Work")');
    if (await activateBtn.isVisible()) {
      await activateBtn.click();
      await expect(page.locator('text=Project Active')).toBeVisible({ timeout: 35000 });
    }

    await page.click('button:has-text("Cloud Link")');

    await page.getByLabel('Deliverable Name / Title').fill('Final Dashboard Build');
    await page.getByLabel('Cloud URL').fill('https://example.com/deliverable.zip');
    await page.click('button:has-text("Add Link Deliverable")');
    await expect(page.locator('text="External link saved as deliverable"').or(page.locator('text="Deliverable link \\"Final Dashboard Build\\" added successfully"'))).toBeVisible({ timeout: 35000 });

    await page.goto(portalUrl);
    await clickTab(page, 'Deliverables', true);
    await expect(page.locator('text=Final Dashboard Build')).toBeVisible();
  });

  test('negative: invalid portal token shows an error, never project data', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/portal/not-a-real-token');
    await expect(page.locator('text=E2E Test Project')).not.toBeVisible();
    await expect(page.locator('body')).toContainText(/invalid|not found|error/i);
  });
});
