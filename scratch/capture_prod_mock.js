import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser to capture guest mock view on prod...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setViewportSize({ width: 1280, height: 900 });
  
  console.log('Navigating to live production site...');
  await page.goto('https://harbour-finance-902b.web.app');
  
  // Set localStorage items to force mock data offline mode
  await page.evaluate(() => {
    localStorage.setItem('harbour_auth_mode', 'offline');
    localStorage.setItem('harbour_force_mock_data', 'true');
  });
  
  // Reload page to apply localStorage configuration
  console.log('Reloading page to apply mock data settings...');
  await page.reload();
  
  // Wait for Markets heading
  await page.waitForSelector('text=Movers for the Markets', { timeout: 10000 });
  console.log('Mock Guest Markets page loaded on prod.');
  
  await page.waitForTimeout(4000);
  
  const screenshotPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/prod_markets_guest_mock.png';
  console.log(`Taking screenshot to: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath });
  
  // Click on the GASCI Index Card
  console.log('Locating and clicking on the GASCI Index card...');
  const gasciCard = page.locator('text=GASCI Index').first();
  await gasciCard.waitFor({ state: 'visible', timeout: 5000 });
  await gasciCard.click();
  
  // Wait for index details to load
  await page.waitForSelector('text=Index Trend', { timeout: 10000 });
  console.log('Mock GASCI Index Details loaded on prod.');
  await page.waitForTimeout(3000);
  
  const detailPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/prod_gasci_detail_guest_mock.png';
  console.log(`Taking screenshot of GASCI Index details to: ${detailPath}`);
  await page.screenshot({ path: detailPath });
  
  await browser.close();
  console.log('Done capturing guest mock screenshots!');
})();
