import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport to laptop screen size
  await page.setViewportSize({ width: 1280, height: 900 });
  
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
  
  // Wait a bit for everything to fully render
  await page.waitForTimeout(3000);
  
  // Take screenshot of Markets overview
  const marketsPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/local_markets.png';
  console.log(`Taking screenshot of Markets overview to: ${marketsPath}`);
  await page.screenshot({ path: marketsPath });
  
  // Click on the GASCI Index Card
  console.log('Locating and clicking on the GASCI Index card...');
  const gasciCard = page.locator('text=GASCI Index').first();
  await gasciCard.waitFor({ state: 'visible', timeout: 5000 });
  await gasciCard.click();
  
  // Wait for index details to load by waiting for the Index Trend header
  await page.waitForSelector('text=Index Trend', { timeout: 5000 });
  console.log('GASCI Index Details loaded.');
  await page.waitForTimeout(2000);
  
  // Take screenshot of Index details overview
  const indexDetailPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/gasci_index_detail.png';
  console.log(`Taking screenshot of GASCI Index details to: ${indexDetailPath}`);
  await page.screenshot({ path: indexDetailPath });
  
  await browser.close();
  console.log('Done capturing screenshots!');
})();
