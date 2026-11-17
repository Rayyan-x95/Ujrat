import { test, expect, type Page } from '@playwright/test';
import { createClient, type Session } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

// Seed the session instead of driving the login form: headless Chrome
// occasionally leaves the password POST hanging. The auth spec still covers
// the real form.
async function signInAsFreelancer(page: Page) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_STORAGE_KEY, JSON.stringify(session)] as const,
  );
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 35000 });
}

async function clickTab(page: any, tabName: string, isPortal = false) {
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

// Portal tokens are hashed at rest (20261107160000): the raw value is
// mintable but never readable. The test generates one and stores only its
// hash, exactly like the freelancer's share action does.
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

test.describe('Client Portal Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message));

    // Authenticate the Node.js test client for RLS-scoped seeding/assertions.
    const { error: authError } = await signInWithRetry();
    if (authError) throw authError;
    session = (await supabase.auth.getSession()).data.session;

    await signInAsFreelancer(page);

    // Ensure the workspace_settings has a upi_id configured so the payment panel is rendered in client portal
    const { data: { user } } = await supabase.auth.getUser();
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('profile_id', user?.id ?? '')
      .is('deleted_at', null)
      .limit(1);

    if (workspaces && workspaces[0]) {
      const workspaceId = workspaces[0].id;
      await supabase
        .from('workspace_settings')
        .update({ upi_id: 'test-payout@upi' })
        .eq('workspace_id', workspaceId);
    }
  });

  test('should complete the entire portal lifecycle: approve proposal, sign contract, submit payment', async ({ page }) => {
    test.setTimeout(240000);
    // 1. Create client first
    const timestamp = Date.now();
    const portalClientEmail = `portal-client-${timestamp}@example.com`;
    const portalClientName = `Portal Client ${timestamp}`;
    await page.goto('/clients');
    await page.click('button:has-text("Add Client")');
    await page.fill('input[placeholder="Arjun Mehta"]', portalClientName);
    await page.fill('input[placeholder="arjun@company.in"]', portalClientEmail);
    await page.click('button:has-text("Register Client")');
    await page.waitForSelector(`text=${portalClientName}`);

    const projectName = `Portal E2E Project ${timestamp}`;

    // 2. Now create the project
    await page.goto('/projects');
    await page.click('button:has-text("New Project")');

    // Fill project form
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByLabel('Target Client').selectOption({ label: portalClientName });
    await page.getByLabel('Project Value / Budget (INR)').fill('25000');
    await page.click('button:has-text("Create Project")');

    // Click the project row to navigate to details
    await page.locator(`text="${projectName}"`).first().click();

    // Should navigate to project details
    await expect(page.locator(`h1:has-text("${projectName}")`)).toBeVisible({ timeout: 35000 });
    await page.waitForURL('**/projects/*');
    const projectUrl = page.url();
    const projectId = projectUrl.split('/').pop() || '';

     // 3. Create and Send Proposal
    await clickTab(page, 'proposal');
    await page.getByLabel('Project Scope & Deliverables Outline').fill('Portal E2E Scope Description');
    await page.getByLabel('Proposal Base Pricing (INR)').fill('25000');
    await page.getByLabel('Proposed Execution Timeline').fill('2 weeks');
    await page.click('button:has-text("Share with Client")');
    await expect(page.locator('text="Proposal Sent to Client"')).toBeVisible({ timeout: 35000 });

    // 4. Mint a portal token (hashed at rest, so it cannot be read back)
    const portalToken = await mintPortalToken(projectId);
    expect(portalToken).toBeTruthy();
    const portalUrl = `/portal/${portalToken}`;

    // 5. Navigate to Client Portal
    await page.goto(portalUrl);
    await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 35000 });
    await clickTab(page, 'Proposal', true);
    await expect(page.locator('text=Approve Proposal')).toBeVisible({ timeout: 35000 });

    // 6. Client approves proposal
    await page.click('button:has-text("Approve Proposal")');
    await expect(page.locator('text=Proposal Approved')).toBeVisible({ timeout: 35000 });

    // 7. Freelancer sends Contract
    await page.goto(projectUrl);
    await clickTab(page, 'contract');
    await page.click('button:has-text("Send Contract to Client")');
    await expect(page.locator('text=Contract Shared with Client')).toBeVisible({ timeout: 35000 });

    // 8. Client signs Contract
    await page.goto(portalUrl);
    await clickTab(page, 'Contract', true);

    // SignaturePad gates on: typed name (>=2 chars) + legal-acknowledgement
    // checkbox + drawn-or-typed mode. Use typed mode so no canvas drawing
    // is required.
    await page.click('button:has-text("Type")');
    await page.fill('input[placeholder="e.g. Rahul Sharma"]', 'Arjun Mehta');
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Sign & Authorize Contract")');
    await expect(page.locator('text=Agreement Signed')).toBeVisible({ timeout: 35000 });

    // 9. Freelancer generates Invoice
    await signInAsFreelancer(page);
    await page.goto(projectUrl);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("Generate Invoice")');
    await page.click('button:has-text("Compute & Create splits")');
    await expect(page.locator('p:has-text("INV-")')).toBeVisible({ timeout: 35000 });

    // A draft is invisible to the client - issue it so the portal can pay it.
    await page.click('button:has-text("Issue to Client")');
    await expect(page.locator('text=Invoice Issued')).toBeVisible({ timeout: 35000 });

    // 10. Client submits payment reference
    await page.goto(portalUrl);
    await clickTab(page, 'Invoices', true);
    await page.click('p:has-text("INV-")');
    const portalUtr = String(Math.floor(100000000000 + Math.random() * 900000000000));
    await page.fill('input[placeholder="e.g. 423156789012"]', portalUtr);
    await page.click('button:has-text("Submit UTR for Verification")');
    await expect(page.locator('text=Payment Submitted').first()).toBeVisible({ timeout: 35000 });

    // 11. Freelancer verifies Payment
    await signInAsFreelancer(page);
    await page.goto(projectUrl);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("View")');
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=The invoice has been transitioned to paid')).toBeVisible({ timeout: 35000 });
  });

  test('portal viewed tracking: two portal opens record two views', async ({ page }) => {
    test.setTimeout(180000);
    // Track: open the same portal twice and expect exactly two recorded
    // views (activity_logs portal_view entries).
    const { data: { user } } = await supabase.auth.getUser();
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('workspace_id', (await supabase.from('workspaces').select('id').eq('profile_id', user?.id ?? '').limit(1)).data?.[0]?.id ?? '')
      .is('deleted_at', null)
      .limit(1);

    if (!projects || projects.length === 0) {
      test.skip(true, 'no project to open in the seeded backend');
    }
    const projectId = projects![0].id as string;
    const rawToken = await mintPortalToken(projectId);
    const portalUrl = async () => {
      await page.goto(`/portal/${rawToken}`);
      await page.waitForSelector('button[role="tab"]', { timeout: 35000 });
    };

    const viewCount = async (): Promise<number | null> => {
      const { count, error } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('action', 'portal_view');
      return error ? null : (count ?? 0);
    };

    const before = await viewCount();
    await portalUrl();
    await portalUrl();
    const after = await viewCount();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect((after ?? 0) - (before ?? 0)).toBe(2);
  });
});
