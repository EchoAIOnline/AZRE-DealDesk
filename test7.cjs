const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:3000');
  
  await page.evaluate(() => {
      localStorage.setItem('deals', JSON.stringify([{
          id: '1', address: '123 Main St', sqft: 1500, status: 'Lead'
      }]));
  });
  await page.reload();
  await new Promise(r => setTimeout(r, 2000));
  
  const trs = await page.$$('tbody tr');
  if (trs.length > 0) {
      console.log("Clicking first deal");
      await trs[0].click();
      await new Promise(r => setTimeout(r, 1000));
  } else {
      console.log("No deals found");
  }
  await browser.close();
})();
