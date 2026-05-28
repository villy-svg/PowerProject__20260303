import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const outputDir = path.join(__dirname, 'Tutorial Screenshots');
  if (!fs.existsSync(outputDir)) {
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
    if (setupFn) {
      await setupFn();
      await delay(1000); // Wait for animations / transitions to settle
    }

    // 1. Desktop Screenshot
    await page.setViewport({ width: 1440, height: 900 });
    // Adjust agent to look like desktop
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await delay(500);
    const desktopPath = path.join(outputDir, `${name}_Desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: false });
    console.log(`Saved: ${desktopPath}`);

    // 2. Mobile Screenshot (simulate mobile viewport/agent)
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
    await delay(800);
    const mobilePath = path.join(outputDir, `${name}_Mobile.png`);
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log(`Saved: ${mobilePath}`);
  }

  try {
    console.log('Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for application to bootstrap...');
    // The loading text says "Connecting to Cloud Database..."
    // Wait for the loading text to disappear or for dashboard items to render
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Connecting to Cloud Database...') && (text.includes('Dashboard') || text.includes('Executive Summary'));
    }, { timeout: 30000 });
    
    console.log('Application loaded successfully!');
    await delay(1000);

    // Flow 1: Main Dashboard (Executive Summary)
    await capture('01_Dashboard', async () => {
      // Just make sure viewport is set and any overlays are closed
    });

    // Flow 2: Charging Hubs Board
    await capture('02_ChargingHubs_Workspace', async () => {
      // Switch back to desktop view first for clicks, to ensure elements are present and visible
      await page.setViewport({ width: 1440, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await delay(200);

      // Find and click "Charging Hubs" in sidebar (or click a list item containing the text)
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li, span'));
        const hubsItem = items.find(el => el.innerText && el.innerText.trim() === 'Charging Hubs');
        if (hubsItem) {
          hubsItem.click();
        } else {
          console.error('Charging Hubs menu item not found');
        }
      });
    });

    // Flow 3: Charging Hubs Sub-menus (Hub Administration)
    await capture('03_Hub_Administration', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await delay(200);

      // Click the expand toggle chevron or click directly on Hub Administration if visible
      await page.evaluate(() => {
        // Expand the submenu if not expanded
        const toggleBtn = document.querySelector('.v-toggle-btn');
        if (toggleBtn) toggleBtn.click();
      });
      await delay(500);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li'));
        const subItem = items.find(el => el.innerText && el.innerText.trim() === 'Hub Administration');
        if (subItem) subItem.click();
      });
    });

    // Flow 4: Function Manager
    await capture('04_Hub_Function_Manager', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li'));
        const subItem = items.find(el => el.innerText && el.innerText.trim() === 'Function Manager');
        if (subItem) subItem.click();
      });
    });

    // Flow 5: Employees Workspace
    await capture('05_Employees_Workspace', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li, span'));
        const target = items.find(el => el.innerText && el.innerText.trim() === 'Employees');
        if (target) target.click();
      });
    });

    // Flow 6: Department Manager
    await capture('06_Department_Manager', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        // Find toggles. The second toggle is likely Employees if sorted index
        const toggles = Array.from(document.querySelectorAll('.v-toggle-btn'));
        if (toggles.length > 1) toggles[1].click(); // Toggle Employees
      });
      await delay(500);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li'));
        const target = items.find(el => el.innerText && el.innerText.trim() === 'Department Manager');
        if (target) target.click();
      });
    });

    // Flow 7: Clients Workspace
    await capture('07_Clients_Workspace', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li, span'));
        const target = items.find(el => el.innerText && el.innerText.trim() === 'Clients');
        if (target) target.click();
      });
    });

    // Flow 8: Clients Category Manager
    await capture('08_Clients_Category_Manager', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        const toggles = Array.from(document.querySelectorAll('.v-toggle-btn'));
        // Find the toggle for clients
        if (toggles.length > 2) toggles[2].click();
      });
      await delay(500);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li'));
        const target = items.find(el => el.innerText && el.innerText.trim() === 'Category Manager');
        if (target) target.click();
      });
    });

    // Flow 9: Configuration Screen
    await capture('09_Configuration', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li'));
        const target = items.find(el => el.innerText && el.innerText.trim() === 'Configuration');
        if (target) target.click();
      });
    });

    // Flow 10: Role Management / Permissions
    await capture('10_User_Role_Management', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        // From configuration or sidebar, go to role management
        const items = Array.from(document.querySelectorAll('li, button'));
        const target = items.find(el => el.innerText && (el.innerText.trim() === 'Role Management' || el.innerText.includes('Role Manager')));
        if (target) target.click();
      });
    });

    // Flow 11: User Management Screen
    await capture('11_User_Management', async () => {
      await page.setViewport({ width: 1440, height: 900 });
      await delay(200);
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li'));
        const target = items.find(el => el.innerText && el.innerText.trim() === 'User Management');
        if (target) target.click();
      });
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
