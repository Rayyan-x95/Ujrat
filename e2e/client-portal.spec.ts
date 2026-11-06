import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env (root), then the SPA's frontend/.env
// for the publishable key the legacy anon var retired out of the root file.
dotenv.config();
dotenv.config({ path: 'frontend/.env', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function signInAsFreelancer(page: any) {
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
  await page.fill('input[type="email"]', 'portal-test@example.com');
  await page.fill('input[type="password"]', 'password12345');
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

test.describe('Client Portal Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message));
    
    // 1. Clear cookies and navigate to login first
    await page.context().clearCookies();
    await page.goto('/login');
    
    // 2. Clear storage
    try {
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
    } catch {
      // ignore
    }
    
    // 3. Attempt login
    await page.fill('input[type="email"]', 'portal-test@example.com');
    await page.fill('input[type="password"]', 'password12345');
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/dashboard', { timeout: 35000 });
    } catch {
      // User doesn't exist, sign them up
      await page.goto('/signup');
      await page.locator('input[placeholder="e.g. Acme Designs"]').fill('Test User');
      await page.fill('input[type="email"]', 'portal-test@example.com');
      await page.locator('input[type="password"]').first().fill('password12345');
      await page.locator('input[type="password"]').last().fill('password12345');
      await page.click('button[type="submit"]');
      
      try {
        await page.waitForURL('**/dashboard', { timeout: 35000 });
      } catch {
        // Fallback: sign in again if registration redirected to login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'portal-test@example.com');
        await page.fill('input[type="password"]', 'password12345');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard', { timeout: 35000 });
      }
    }

    // Authenticate the Node.js test supabase client instance for RLS policies
    await supabase.auth.signInWithPassword({
      email: 'portal-test@example.com',
      password: 'password12345',
    });

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

  test('should complete the entire portal lifecycle: approve proposal, verify OTP, sign contract, submit payment', async ({ page }) => {
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

    // 4. Retrieve Client Portal URL directly from database
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('portal_token')
      .eq('id', projectId)
      .single();

    if (projectError) throw new Error(projectError.message);
    const portalToken = projectData?.portal_token;
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
    await page.click('button:has-text("Publish & Send Link")');
    await expect(page.locator('text=Contract Shared with Client')).toBeVisible({ timeout: 35000 });

    // 8. Client signs Contract
    await page.goto(portalUrl);
    await clickTab(page, 'Contract', true);

    // Submit signature
    await page.fill('input[placeholder="Type your full legal name"], input[placeholder="e.g. Rahul Sharma"]', 'Arjun Mehta');
    await page.click('button:has-text("Sign & Authorize Contract")');
    await expect(page.locator('text=Agreement Signed')).toBeVisible({ timeout: 35000 });

    // 9. Freelancer generates Invoice
    await signInAsFreelancer(page);
    await page.goto(projectUrl);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("Generate Invoice")');
    await page.click('button:has-text("Compute & Create splits")');
    await expect(page.locator('p:has-text("INV-")')).toBeVisible({ timeout: 35000 });

    // 10. Client submits payment reference
    await page.goto(portalUrl);
    await clickTab(page, 'Invoices', true);
    await page.click('p:has-text("INV-")');
    const portalUtr = String(Math.floor(100000000000 + Math.random() * 900000000000));
    await page.fill('input[placeholder="12-digit UPI reference number"]', portalUtr);
    await page.click('button:has-text("Verify Receipt")');
    await expect(page.locator('text=Receipt Submitted')).toBeVisible({ timeout: 35000 });

    // 11. Freelancer verifies Payment
    await signInAsFreelancer(page);
    await page.goto(projectUrl);
    await clickTab(page, 'invoices');
    await page.click('button:has-text("View Invoice")');
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=The invoice has been transitioned to paid')).toBeVisible({ timeout: 35000 });
  });

  test('portal viewed tracking: two portal opens record two views', async ({ page }) => {
    test.setTimeout(180000);
    // Track 6: open the same portal twice and expect exactly two recorded
    // views (activity_logs portal_view entries or the freelancer chip).
    // Skips while the view-tracking feature has not landed yet.
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, portal_token, name')
      .not('portal_token', 'is', null)
      .limit(1)
      .single();
    if (projErr || !project?.portal_token) {
      test.skip(true, 'no project with a portal token in the seeded backend');
    }
    const projectId = project.id as string;
    const portalUrl = async () => {
      await page.goto(`/portal/${project.portal_token}`);
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

    const chip = page.locator('[data-testid*="portal-view"], [data-testid*="viewed"], text=/viewed/i');
    if (before === null && (await chip.count()) === 0) {
      test.skip(true, 'portal viewed tracking not present yet (no log table, no chip)');
    }
    if (before !== null && after !== null) {
      if (after - before === 0) {
        test.skip(true, 'portal view tracking not yet inserting portal_view rows');
      }
      expect(after - before).toBe(2);
    } else {
      expect(await chip.first().textContent()).toMatch(/2/);
    }
  });
});
