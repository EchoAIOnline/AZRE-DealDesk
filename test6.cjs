const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on a deal row to open Edit Deal Modal
  // First td usually has the address
  const trs = await page.$$('tbody tr');
  if (trs.length > 0) {
      console.log("Clicking first deal");
      await trs[0].click();
      await new Promise(r => setTimeout(r, 1000));
      
      const modal = await page.evaluate(() => {
          const m = document.querySelector('.fixed.inset-0.z-50');
          return m ? m.innerHTML.length : 0;
      });
      console.log("Modal HTML length:", modal);
  } else {
      console.log("No deals found");
  }
  await browser.close();
})();
