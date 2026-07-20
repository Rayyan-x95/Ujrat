import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form with all fields', async ({ page }) => {
    await expect(page.locator('text=Sign In to Ujrat')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.click('text=Create an account');
    await expect(page).toHaveURL('/signup');
    await expect(page.locator('text=Create Your Workspace')).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.click('text=Forgot?');
    await expect(page).toHaveURL('/forgot');
    await expect(page.locator('text=Reset Password')).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Email address is required')).toBeVisible();
  });

  test('should show validation error for short password on signup', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.locator('input[type="password"]').first().fill('123');
    await page.locator('input[type="password"]').last().fill('123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible();
  });
});
