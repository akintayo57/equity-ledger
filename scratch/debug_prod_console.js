import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser with console logging...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewportSize({ width: 1280, height: 900 });
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR] ${err.toString()}`);
  });

  console.log('Navigating to live production site...');
  await page.goto('https://harbour-finance-902b.web.app');
  
  // Click guest button
  const guestBtn = page.getByRole('button', { name: 'Continue as Guest / Developer' });
  try {
    await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await guestBtn.click();
    console.log('Clicked guest button...');
  } catch (e) {
    console.log('Guest button not found');
  }
  
  // Wait 10 seconds to allow network calls to finish and logs to print
  await page.waitForTimeout(10000);
  
  await browser.close();
  console.log('Done debugging!');
})();
