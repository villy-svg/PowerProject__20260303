import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const outputDir = path.join(__dirname, 'public', 'Tutorial Screenshots');
  if (fs.existsSync(outputDir)) {
    // Delete any old png files in this directory to get rid of outdated junk screenshots
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        fs.unlinkSync(path.join(outputDir, file));
      }
    }
    console.log(`Cleaned old screenshots inside: ${outputDir}`);
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  console.log('Starting Vite server...');
  const server = await createServer({
    configFile: path.join(__dirname, 'vite.config.js'),
    server: {
      port: 5173,
    },
  });
  await server.listen();
  console.log('Vite server started at http://localhost:5173');

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Helper function to capture both Desktop and Mobile screenshots for a state
  async function capture(name, setupFn) {
    console.log(`\n--- Capturing: ${name} ---`);

    // 1. Desktop Screenshot
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await delay(500);
    if (setupFn) {
      await setupFn('desktop');
      await delay(1200); // Wait for transition animations to settle
    }
    const desktopPath = path.join(outputDir, `${name}_Desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: false });
    console.log(`Saved: ${desktopPath}`);

    // 2. Mobile Screenshot (simulate mobile viewport/agent)
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
    await delay(800);
    if (setupFn) {
      await setupFn('mobile');
      await delay(1500); // Give extra time for mobile renders & tab drawer switches
    }
    const mobilePath = path.join(outputDir, `${name}_Mobile.png`);
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log(`Saved: ${mobilePath}`);
  }

  try {
    console.log('Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for application to bootstrap...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Connecting to Cloud Database...') && (text.includes('Dashboard') || text.includes('Executive Summary'));
    }, { timeout: 30000 });
    
    console.log('Application loaded successfully!');
    await delay(1500);

    // Slide 1: Home Escalations Board
    await capture('01_ReadHomepage_Escalations', async (mode) => {
      if (mode === 'mobile') {
        await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.summary-nav-item'));
          const esc = items.find(el => el.innerText && el.innerText.toLowerCase().includes('escalations'));
          if (esc) esc.click();
        });
      }
    });

    // Slide 2: Centralised Task View
    await capture('01_ReadHomepage_Tasks', async (mode) => {
      if (mode === 'desktop') {
        await page.evaluate(() => {
          const btn = document.querySelector('.centralised-task-view .board-collapse-toggle-btn');
          if (btn && btn.getAttribute('aria-expanded') === 'false') {
            btn.click();
          }
        });
      } else if (mode === 'mobile') {
        await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.summary-nav-item'));
          const tasks = items.find(el => el.innerText && el.innerText.toLowerCase().includes('tasks'));
          if (tasks) tasks.click();
        });
      }
    });

    // Slide 3: Executive Summary Grid / Metrics
    await capture('01_ReadHomepage_Metrics', async (mode) => {
      if (mode === 'desktop') {
        await page.evaluate(() => {
          const el = document.querySelector('.home-summary-view');
          if (el) {
            el.scrollTo(0, el.scrollHeight);
          } else {
            window.scrollTo(0, document.body.scrollHeight);
          }
        });
      } else if (mode === 'mobile') {
        await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.summary-nav-item'));
          const metrics = items.find(el => el.innerText && el.innerText.toLowerCase().includes('executive summary'));
          if (metrics) metrics.click();
        });
      }
    });

  } catch (error) {
    console.error('Error during screenshot flow:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Stopping Vite server...');
    await server.close();
    console.log('Done!');
  }
}

run();
