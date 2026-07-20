import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function signInAsTestUser(page: Page, email = 'e2e-test@example.com', password = 'password123') {
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
    if (className && className.includes('bg-primary-muted')) {
      isActive = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  expect(isActive).toBe(true);
}

async function signUpTestUser(page: Page, email = 'e2e-test@example.com', password = 'password123', name = 'E2E Test User') {
  await page.goto('/signup');
  await page.locator('input[placeholder="Rohan Sharma"]').fill(name);
  await page.fill('input[type="email"]', email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('input[type="password"]').last().fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 35000 });
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
  const { data } = await supabase.from('projects').select('portal_token').eq('id', projectId).single();
  return data?.portal_token;
}

async function waitForOtp(clientEmail: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('email_logs')
      .select('body')
      .eq('recipient', clientEmail)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    const otp = data?.[0]?.body.match(/(?:code is:|is:)\s*(?:<b>)?(\d{6})(?:<\/b>)?/i)?.[1];
    if (otp) return otp;
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  throw new Error('Timed out waiting for the portal verification code.');
}

test.describe.configure({ retries: 1 });

test.describe('Complete Freelancer Business Lifecycle', () => {
  test('should complete the entire business lifecycle sequentially', async ({ page }) => {
    test.setTimeout(240000);
    const timestamp = Date.now();
    const testUserEmail = `e2e-${timestamp}@example.com`;
    const testUserPassword = 'password123';
    let workspaceId = '';
    let profileId = '';
    let clientId = '';
    let projectId = '';
    let portalToken = '';
    let invoiceId = '';

    // 1. Signup → Workspace → Client → Project
    await signUpTestUser(page, testUserEmail, testUserPassword, 'E2E Test User');

    // Authenticate Supabase JS client to allow DB calls
    await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testUserPassword,
    });

    const { data: { user } } = await supabase.auth.getUser();
    profileId = user!.id;
    expect(profileId).toBeTruthy();

    const { data: workspaces } = await supabase.from('workspaces').select('id').eq('profile_id', profileId).is('deleted_at', null);
    workspaceId = workspaces?.[0]?.id;
    expect(workspaceId).toBeTruthy();

    await supabase
      .from('workspace_settings')
      .update({ upi_id: 'test-payout@upi' })
      .eq('workspace_id', workspaceId);

    const testClientEmail = `client-e2e-${timestamp}@example.com`;
    const clientResult = await createClientViaAPI(workspaceId, {
      name: 'E2E Client Corp',
      email: testClientEmail,
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

    // 2. Create & Send Proposal (Freelancer) → Approve (Client Portal)
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'proposal');
    
    await page.getByLabel('Project Scope & Deliverables Outline').fill('E2E test scope: Build a dashboard with charts and exports');
    await page.getByLabel('Proposal Base Pricing (INR)').fill('50000');
    await page.getByLabel('Proposed Execution Timeline').fill('4 weeks');
    await page.click('button:has-text("Save Draft")');
    await expect(page.locator('text=Proposal Draft Saved')).toBeVisible({ timeout: 35000 });

    await page.click('button:has-text("Share with Client")');
    await expect(page.locator('text="Proposal Sent to Client"')).toBeVisible({ timeout: 35000 });

    const portalUrl = `/portal/${portalToken}`;
    await page.goto(portalUrl);
    await expect(page.locator('text=E2E Test Project')).toBeVisible({ timeout: 35000 });
    await clickTab(page, 'Proposal', true);
    await expect(page.locator('text=Approve Proposal')).toBeVisible();
    await page.click('button:has-text("Approve Proposal")');
    await expect(page.locator('text=Proposal Approved')).toBeVisible({ timeout: 35000 });

    // 3. Create & Send Contract (Freelancer) → OTP Verify → Sign (Client Portal)
    await signInAsTestUser(page, testUserEmail, testUserPassword);

    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'contract');
    await page.click('button:has-text("Publish & Send Link")');
    await expect(page.locator('text=Contract Shared with Client')).toBeVisible({ timeout: 35000 });

    await page.goto(portalUrl);
    await clickTab(page, 'Contract', true);
    await page.click('button:has-text("Generate Verification OTP")');
    await expect(page.getByText('OTP Code Sent', { exact: true })).toBeVisible({ timeout: 35000 });

    const otpCode = await waitForOtp(testClientEmail);

    await page.fill('input[placeholder="123456"]', otpCode);
    await page.click('button:has-text("Verify Identity")');
    await expect(page.locator('text=Client Verified')).toBeVisible({ timeout: 35000 });

    await page.fill('input[placeholder="Type your full legal name"]', 'E2E Test Client');
    await page.click('button:has-text("Sign & Authorize Contract")');
    await expect(page.locator('text=Agreement Signed')).toBeVisible({ timeout: 35000 });

    const { data: contract } = await supabase.from('contracts').select('id').eq('project_id', projectId).is('deleted_at', null).single();
    expect(contract?.id).toBeTruthy();

    // 4. Generate Invoice (Freelancer) → Submit Payment (Client Portal) → Verify (Freelancer)
    await signInAsTestUser(page, testUserEmail, testUserPassword);

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
    invoiceId = invoice.id;
    expect(invoiceId).toBeTruthy();

    await page.goto(portalUrl);
    await clickTab(page, 'Invoices', true);
    await page.click(`p:has-text("${invoice.invoice_number}")`);
    const lifecycleUtr = String(Math.floor(100000000000 + Math.random() * 900000000000));
    await page.fill('input[placeholder="12-digit UPI reference number"]', lifecycleUtr);
    await page.click('button:has-text("Verify Receipt")');
    await expect(page.locator('text=Receipt Submitted')).toBeVisible({ timeout: 35000 });

    await signInAsTestUser(page, testUserEmail, testUserPassword);
    await page.goto(`/projects/${projectId}`);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("View Invoice")');
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=The invoice has been transitioned to paid')).toBeVisible({ timeout: 35000 });

    const { data: paidInvoice } = await supabase.from('invoices').select('status').eq('id', invoiceId).single();
    expect(paidInvoice?.status).toBe('paid');

    // 5. Upload Deliverables → Client Download
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
});
