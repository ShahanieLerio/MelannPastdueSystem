const { test, expect } = require('@playwright/test');

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login.html');
    });

    test('should display login form', async ({ page }) => {
        await expect(page.locator('h2')).toContainText('Past Due & Reports');
        await expect(page.locator('#username')).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.locator('#loginForm .btn-login')).toBeVisible();
    });

    test('should show error on invalid login', async ({ page }) => {
        await page.fill('#username', 'wronguser');
        await page.fill('#password', 'wrongpass');
        await page.click('#loginForm .btn-login');

        // The error message might take a moment or depend on login.js implementation
        const message = page.locator('#loginMessage');
        await expect(message).toBeVisible();
    });

    test('should toggle to register form', async ({ page }) => {
        await page.click('#toggleFormBtn');
        await expect(page.locator('#reg_fullname')).toBeVisible();
        await expect(page.locator('#loginForm')).toHaveClass(/hidden/);
    });
});
