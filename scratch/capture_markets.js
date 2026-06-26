import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport to laptop screen size
  await page.setViewportSize({ width: 1280, height: 800 });
  
  console.log('Navigating to local Harbour Finance dev server...');
  await page.goto('http://localhost:3000');
  
  // Wait for login or main screen
  const guestBtn = page.getByRole('button', { name: 'Continue as Guest / Developer' });
  try {
    await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await guestBtn.click();
    console.log('Bypassed login screen...');
  } catch (e) {
    console.log('Guest button not found, assuming already logged in');
  }
  
  // Wait for Markets heading
  await page.waitForSelector('text=Movers for the Markets', { timeout: 10000 });
  console.log('Markets page loaded.');
  
  // Wait a bit for everything (e.g. layout, CSS) to fully render
  await page.waitForTimeout(2500);
  
  const screenshotPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/local_markets_laptop.png';
  console.log(`Taking screenshot and saving to: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  
  await browser.close();
  console.log('Done!');
})();
