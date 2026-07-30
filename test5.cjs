const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.evaluate(() => document.body.innerHTML);
  if (html.includes('id="root"')) {
     const rootHtml = await page.evaluate(() => document.getElementById('root').innerHTML);
     console.log("Root length:", rootHtml.length);
     if (rootHtml.length < 500) console.log("Root HTML:", rootHtml);
  }
  await browser.close();
})();
