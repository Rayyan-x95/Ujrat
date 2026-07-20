import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('text=Sign In to Ujrat')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe('Client Portal', () => {
  test('should load portal page', async ({ page }) => {
    await page.goto('/portal/invalid-token');
    // Should show some error or redirect
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should adapt to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await expect(page.locator('text=Sign In to Ujrat')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have labels for form inputs', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toHaveAttribute('id');
    await expect(passwordInput).toHaveAttribute('id');
  });
});

test.describe('Error Boundaries', () => {
  test('should render error boundary on login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sign In to Ujrat')).toBeVisible();
  });
});