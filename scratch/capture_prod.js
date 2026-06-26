import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser to capture production site...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport to laptop screen size
  await page.setViewportSize({ width: 1280, height: 900 });
  
  console.log('Navigating to live production site...');
  await page.goto('https://harbour-finance-902b.web.app');
  
  // Wait for login screen or bypass button
  const guestBtn = page.getByRole('button', { name: 'Continue as Guest / Developer' });
  try {
    await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await guestBtn.click();
    console.log('Bypassed login screen...');
  } catch (e) {
    console.log('Guest button not found, assuming already logged in or direct access');
  }
  
  // Wait for Markets heading
  await page.waitForSelector('text=Movers for the Markets', { timeout: 15000 });
  console.log('Production Markets page loaded.');
  
  // Wait a bit for everything to fully render
  await page.waitForTimeout(4000);
  
  const screenshotPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/prod_markets.png';
  console.log(`Taking screenshot of production site to: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath });
  
  // Click on the GASCI Index Card
  console.log('Locating and clicking on the GASCI Index card...');
  const gasciCard = page.locator('text=GASCI Index').first();
  await gasciCard.waitFor({ state: 'visible', timeout: 5000 });
  await gasciCard.click();
  
  // Wait for index details to load
  await page.waitForSelector('text=Index Trend', { timeout: 10000 });
  console.log('GASCI Index Details loaded on prod.');
  await page.waitForTimeout(3000);
  
  const detailPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/prod_gasci_detail.png';
  console.log(`Taking screenshot of production GASCI Index details to: ${detailPath}`);
  await page.screenshot({ path: detailPath });
  
  await browser.close();
  console.log('Done capturing production screenshots!');
})();
