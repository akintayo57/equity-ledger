import { chromium } from 'playwright';

(async () => {
  console.log('Launching HEADED browser (a window will pop up on your screen)...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setViewportSize({ width: 1280, height: 900 });
  
  console.log('Navigating to live production site...');
  await page.goto('https://harbour-finance-902b.web.app');
  
  console.log('\n========================================================');
  console.log('*** PLEASE LOG IN USING THE POPPED-UP BROWSER WINDOW ***');
  console.log('========================================================\n');
  console.log('Waiting up to 2 minutes for you to complete login...');
  
  // Wait for the Markets dashboard to load (meaning login completed)
  await page.waitForSelector('text=Movers for the Markets', { timeout: 120000 });
  console.log('Logged in successfully! Capturing screenshots...');
  
  // Wait for data to render fully
  await page.waitForTimeout(4000);
  
  const screenshotPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/prod_markets_authenticated.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved dashboard screenshot to: ${screenshotPath}`);
  
  // Click on the GASCI Index Card
  console.log('Locating and clicking on the GASCI Index card...');
  const gasciCard = page.locator('text=GASCI Index').first();
  await gasciCard.waitFor({ state: 'visible', timeout: 5000 });
  await gasciCard.click();
  
  // Wait for index details to load
  await page.waitForSelector('text=Index Trend', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  const detailPath = '/Users/akintayo/.gemini/antigravity/brain/c795e084-dbdf-4d95-9e2d-a06f28711f0a/prod_gasci_detail_authenticated.png';
  await page.screenshot({ path: detailPath });
  console.log(`Saved details screenshot to: ${detailPath}`);
  
  await browser.close();
  console.log('Done capturing authenticated screenshots!');
})();
