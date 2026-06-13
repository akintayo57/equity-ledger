import { test, expect } from '@playwright/test';

test.describe('Harbour Finance Core User Journey', () => {
  test('should run the complete E2E workflow successfully', async ({ page }) => {
    // Inject a stylesheet on every page load (including reloads) to hide the Firebase Auth Emulator warning banner.
    // This warning banner floats at the bottom of the viewport and intercepts navigation clicks on mobile viewports.
    await page.addInitScript(() => {
      window.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.innerHTML = `
          .firebase-emulator-warning { 
            display: none !important; 
            pointer-events: none !important; 
            visibility: hidden !important; 
            height: 0px !important; 
            overflow: hidden !important; 
          }
        `;
        document.head.appendChild(style);
      });
    });

    // 1. Visit the default page (Markets)
    await page.goto('/');

    // If we are on the login screen, click "Continue as Guest / Developer" to bypass it
    const guestBtn = page.getByRole('button', { name: 'Continue as Guest / Developer' });
    try {
      await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
      await guestBtn.click();
    } catch (e) {
      console.log('Guest button not found, assuming already logged in');
    }

    // Assert that we have landed on the Markets page
    await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible();

    // 2. Search for BTI
    const searchInput = page.getByPlaceholder('Search all equities across exchanges...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('BTI');

    // Wait for dropdown result and click it
    const dropdownItem = page.locator('button:has-text("BTI")').first();
    await expect(dropdownItem).toBeVisible();
    await dropdownItem.click();

    // Assert that the GBTI expanded fundamentals details are rendered
    await expect(page.getByText('Guyana Bank for Trade and Industry Limited')).toBeVisible();
    await expect(page.getByText('Market Profile & Fundamentals')).toBeVisible();

    // 3. Watchlist Toggling (Self-healing logic to handle pre-seeded watchlist states)
    const removeBtn = page.locator('button[title="Remove from Watchlist"]');
    const addBtn = page.locator('button[title="Add to Watchlist"]');

    if (await removeBtn.isVisible()) {
      // If already watched, remove and then add back to test both transitions
      await removeBtn.click();
      await expect(addBtn).toBeVisible();
      await addBtn.click();
      await expect(removeBtn).toBeVisible();
    } else {
      // If not watched, add it
      await addBtn.click();
      await expect(removeBtn).toBeVisible();
    }

    // 4. Navigate to Portfolio page via bottom navigation
    const portfolioLink = page.getByRole('link', { name: 'Portfolio' });
    await portfolioLink.click();

    // Assert Portfolio page rendered (exact match to avoid heading conflict with "Portfolio Trend")
    await expect(page.getByRole('heading', { name: 'Portfolio', exact: true })).toBeVisible();

    // Switch to Watchlist tab
    const watchlistTab = page.getByRole('button', { name: 'Watchlist' });
    await watchlistTab.click();

    // Assert that BTI is visible in the watchlist (.first() avoids conflict with Recharts charts legends)
    await expect(page.getByText('BTI').first()).toBeVisible();

    // 5. Navigate to Settings via top header Settings link
    const settingsLink = page.getByTitle('Settings');
    await settingsLink.click();

    // Assert Settings page active
    await expect(page.getByText('Settings Menu')).toBeVisible();

    // Switch settings menu to User Profile tab
    const selectMenu = page.locator('#settings-menu-select');
    await selectMenu.selectOption('PROFILE');

    // Assert that we see user preference or profile card
    await expect(page.getByText('Theme Preference')).toBeVisible();

    // Toggles light vs dark theme
    const darkBtn = page.getByRole('button', { name: 'Dark Mode' });
    const lightBtn = page.getByRole('button', { name: 'Light Mode' });

    // Click dark mode
    await darkBtn.click();
    // Check that html class has .dark
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // Click light mode
    await lightBtn.click();
    await expect(htmlElement).not.toHaveClass(/dark/);
  });
});
