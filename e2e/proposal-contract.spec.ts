import { test, expect } from '@playwright/test';

test.describe('Proposal → Contract Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Clear session to prevent cross-test pollution
    await page.context().clearCookies();
    await page.goto('/login');
    try {
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
    } catch {
      // ignore
    }
    
    // 3. Attempt login
    await page.fill('input[type="email"]', 'proposal-test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/dashboard', { timeout: 35000 });
    } catch {
      // User doesn't exist, sign them up
      await page.goto('/signup');
      await page.locator('input[placeholder="Rohan Sharma"]').fill('Test User');
      await page.fill('input[type="email"]', 'proposal-test@example.com');
      await page.locator('input[type="password"]').first().fill('password123');
      await page.locator('input[type="password"]').last().fill('password123');
      await page.click('button[type="submit"]');
      
      try {
        await page.waitForURL('**/dashboard', { timeout: 35000 });
      } catch {
        // Fallback: sign in again if registration redirected to login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'proposal-test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard', { timeout: 35000 });
      }
    }
  });

  test('should create a project and navigate to details', async ({ page }) => {
    const timestamp = Date.now();
    const clientEmail = `client-1-${timestamp}@example.com`;
    const clientName = `E2E Client ${timestamp}`;
    const projectName = `E2E Test Project ${timestamp}`;

    // 1. Create client first
    await page.goto('/clients');
    await page.click('button:has-text("Add Client")');
    await page.fill('input[placeholder="Arjun Mehta"]', clientName);
    await page.fill('input[placeholder="arjun@company.in"]', clientEmail);
    await page.click('button:has-text("Register Client")');
    await page.waitForSelector(`text=${clientName}`);

    // 2. Now create the project
    await page.goto('/projects');
    await page.click('button:has-text("New Project")');
    
    // Fill project form
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByLabel('Target Client').selectOption({ label: clientName });
    await page.getByLabel('Project Value / Budget (INR)').fill('50000');
    await page.click('button:has-text("Create Project")');
    
    // Click the project row to navigate to details
    await page.locator(`text="${projectName}"`).first().click();
    
    // Should navigate to project details
    await expect(page.locator(`h1:has-text("${projectName}")`)).toBeVisible();
  });

  test('should create and send a proposal', async ({ page }) => {
    const timestamp = Date.now();
    const clientEmail = `client-2-${timestamp}@example.com`;
    const clientName = `E2E Client ${timestamp}`;
    const projectName = `E2E Test Project ${timestamp}`;

    // 1. Create client first
    await page.goto('/clients');
    await page.click('button:has-text("Add Client")');
    await page.fill('input[placeholder="Arjun Mehta"]', clientName);
    await page.fill('input[placeholder="arjun@company.in"]', clientEmail);
    await page.click('button:has-text("Register Client")');
    await page.waitForSelector(`text=${clientName}`);

    // 2. Now create the project
    await page.goto('/projects');
    await page.click('button:has-text("New Project")');
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByLabel('Target Client').selectOption({ label: clientName });
    await page.getByLabel('Project Value / Budget (INR)').fill('50000');
    await page.click('button:has-text("Create Project")');
    
    // Click the project row to navigate to details
    await page.locator(`text="${projectName}"`).first().click();
    
    // Wait for redirect to project details
    await page.waitForURL('**/projects/*');
    
    // Navigate to proposal tab
    await page.click('nav[aria-label="Project workflow"] button:has-text("proposal")');
    
    // Fill proposal
    await page.getByLabel('Project Scope & Deliverables Outline').fill('E2E test scope');
    await page.getByLabel('Proposal Base Pricing (INR)').fill('75000');
    await page.getByLabel('Proposed Execution Timeline').fill('4 weeks');
    
    // Save as draft
    await page.click('button:has-text("Save Draft")');
    await expect(page.locator('text=Proposal Draft Saved')).toBeVisible({ timeout: 35000 });
    
    // Send proposal
    await page.click('button:has-text("Share with Client")');
    await expect(page.locator('text="Proposal Sent to Client"')).toBeVisible({ timeout: 35000 });
  });
});
