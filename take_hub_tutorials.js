import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const outputDir = path.join(__dirname, 'Tutorial Screenshots', 'Hub Manager Tutorials');
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
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for application to bootstrap...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Connecting to Cloud Database...') && (text.includes('Dashboard') || text.includes('Executive Summary'));
    }, { timeout: 30000 });
    
    console.log('Application loaded successfully!');
    await delay(1000);

    // 1. Go to Charging Hubs (Hub Manager) Workspace
    console.log('Navigating to Hub Manager Workspace...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li, span'));
      const hubsItem = items.find(el => el.innerText && el.innerText.trim() === 'Hub Manager');
      if (hubsItem) {
        hubsItem.click();
      } else {
        console.error('Hub Manager menu item not found');
      }
    });
    await delay(1500);

    // Take screenshot of main board
    await page.screenshot({ path: path.join(outputDir, '01_ChargingHubs_Main_Board.png') });
    console.log('Saved: 01_ChargingHubs_Main_Board.png');

    // 2. Click "+ Add Task" button on board
    console.log('Opening Add Task Modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addTaskBtn = buttons.find(b => b.innerText && b.innerText.includes('Add Task'));
      if (addTaskBtn) {
        addTaskBtn.click();
      } else {
        const plusButton = document.querySelector('.add-task-btn, [title="Add Task"], .board-header-actions button');
        if (plusButton) plusButton.click();
      }
    });
    
    console.log('Waiting for #task-summary selector...');
    await page.waitForSelector('#task-summary', { timeout: 8000 });
    await delay(500);

    // Take screenshot of Add Task Modal
    await page.screenshot({ path: path.join(outputDir, '02_ChargingHubs_Add_Task_Modal.png') });
    console.log('Saved: 02_ChargingHubs_Add_Task_Modal.png');

    // 3. Populate form to select Multi-Hub
    console.log('Filing details to trigger Multi-Hub orchestration...');
    await page.type('#task-summary', 'Automatic Station Maintenance check');
    await page.type('#detailed-description', 'Check standard chargers, screen displays, cable pins, status indicator LEDs.');
    
    // Choose multiple hubs from selector if possible
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      if (checkboxes.length >= 2) {
        checkboxes[0].click();
        checkboxes[1].click();
      } else {
        const options = Array.from(document.querySelectorAll('.hub-option, .custom-select-option, .checkbox-label'));
        if (options.length >= 2) {
          options[0].click();
          options[1].click();
        }
      }
    });
    await delay(800);
    await page.screenshot({ path: path.join(outputDir, '03_ChargingHubs_Add_Task_MultiHub.png') });
    console.log('Saved: 03_ChargingHubs_Add_Task_MultiHub.png');

    // 4. Click Next: Orchestrate Team
    console.log('Orchestrating team...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(b => b.innerText && b.innerText.includes('Orchestrate Team'));
      if (nextBtn) {
        nextBtn.click();
      } else {
        const saveBtn = buttons.find(b => b.innerText && b.innerText.includes('Create Batch'));
        if (saveBtn) saveBtn.click();
      }
    });
    await delay(1200);
    await page.screenshot({ path: path.join(outputDir, '04_ChargingHubs_Orchestrate_Team.png') });
    console.log('Saved: 04_ChargingHubs_Orchestrate_Team.png');

    // Close the modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.close-modal, .form-footer .close-btn, .cancel-btn');
      if (closeBtn) closeBtn.click();
    });
    await delay(1000);

    // 5. Expand Sidebar & Navigate to Hub Administration
    console.log('Navigating to Hub Administration...');
    await page.evaluate(() => {
      const toggleBtn = document.querySelector('.v-toggle-btn');
      if (toggleBtn) toggleBtn.click();
    });
    await delay(500);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li'));
      const subItem = items.find(el => el.innerText && el.innerText.trim() === 'Hub Administration');
      if (subItem) subItem.click();
    });
    await delay(1500);
    await page.screenshot({ path: path.join(outputDir, '05_Hub_Administration_View.png') });
    console.log('Saved: 05_Hub_Administration_View.png');

    // 6. Click "+ Add New Hub"
    console.log('Opening Add New Hub Modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText && b.innerText.includes('Add New Hub'));
      if (btn) btn.click();
    });
    await delay(1000);
    await page.screenshot({ path: path.join(outputDir, '06_Hub_Administration_Add_Modal.png') });
    console.log('Saved: 06_Hub_Administration_Add_Modal.png');

    // Close Modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.close-modal, .cancel-btn');
      if (closeBtn) closeBtn.click();
    });
    await delay(800);

    // 7. Click Function Manager
    console.log('Navigating to Function Manager...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li'));
      const subItem = items.find(el => el.innerText && el.innerText.trim() === 'Function Manager');
      if (subItem) subItem.click();
    });
    await delay(1500);
    await page.screenshot({ path: path.join(outputDir, '07_Hub_Function_Manager_View.png') });
    console.log('Saved: 07_Hub_Function_Manager_View.png');

    // 8. Click "+ New Function"
    console.log('Opening New Function Modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText && b.innerText.includes('New Function'));
      if (btn) btn.click();
    });
    await delay(1000);
    await page.screenshot({ path: path.join(outputDir, '08_Hub_Function_Manager_Add_Modal.png') });
    console.log('Saved: 08_Hub_Function_Manager_Add_Modal.png');

    // Close Modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.close-modal, .cancel-btn');
      if (closeBtn) closeBtn.click();
    });
    await delay(800);

    // 9. Navigate to Daily Task Templates
    console.log('Navigating to Daily Task Templates...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li, span'));
      const target = items.find(el => el.innerText && el.innerText.trim() === 'Daily Task Templates');
      if (target) target.click();
    });
    await delay(1500);
    await page.screenshot({ path: path.join(outputDir, '09_Daily_Tasks_Templates_View.png') });
    console.log('Saved: 09_Daily_Tasks_Templates_View.png');

    // 10. Click "+ New Template"
    console.log('Opening New Template Modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText && b.innerText.includes('New Template'));
      if (btn) btn.click();
    });
    await delay(1000);
    await page.screenshot({ path: path.join(outputDir, '10_Daily_Tasks_Templates_Add_Modal.png') });
    console.log('Saved: 10_Daily_Tasks_Templates_Add_Modal.png');

  } catch (error) {
    console.error('Error during Hub screenshot flow:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Stopping Vite server...');
    await server.close();
    console.log('Done!');
  }
}

run();
