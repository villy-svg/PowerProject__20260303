const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const componentsDir = path.join(srcDir, 'components');

const mappings = {
  "ui": [
    "AnonToggle", "AssigneeBadge", "AssigneeSelector", "BaseDropdown", "CustomSelect",
    "Icons", "Toggle", "SearchBar", "FixTasksButton", "RBACManageButton",
    "CSVDownloadButton", "CSVImportButton", "RoleTooltip", "StatusMsg", "NotificationBell",
    "OnlineSyncBanner", "BulkActionBar"
  ],
  "tasks": [
    "TaskCard", "TaskController", "TaskListView", "TaskKanbanView", "TaskTreeView",
    "CentralisedTaskBoard", "ListViewRow", "TaskHierarchySelector", "SubmissionHistory"
  ],
  "modals": [
    "BoardRBACModal", "ConflictModal", "CSVConflictModal", "ExitAppModal", "RejectionModal",
    "SandboxManagerModal", "SubmissionModal", "TaskModal", "TaskActionModals", "WorkspaceModals"
  ],
  "layout": [
    "MasterPageHeader", "MasterHeaderMenu", "ConfigBottomNav", "BottomNav", "Header", "Sidebar"
  ],
  "dashboard": [
    "ExecutiveSummary", "ExecutiveMetricsSection", "HomeEscalationsBoard"
  ],
  "auth": [
    "Login", "PendingActivation"
  ],
  "workspaces": [
    "Configuration", "VerticalWorkspace"
  ],
  "users": [
    "UserProfile", "UserRoleManagement", "UserManagement"
  ]
};

// 1. Determine all file moves
const oldToNew = new Map();

function getDestinationFolder(baseName) {
  for (const [folder, names] of Object.entries(mappings)) {
    if (names.some(n => baseName.startsWith(n) && (baseName === n || baseName === n + '.jsx' || baseName === n + '.css' || baseName === n + '.js'))) {
      return folder;
    }
  }
  return null;
}

// Read all files in src/components
const entries = fs.readdirSync(componentsDir, { withFileTypes: true });

for (const entry of entries) {
  if (entry.name === 'UserManagement' && entry.isDirectory()) {
    // Special handling for UserManagement directory contents -> move to users/
    const subEntries = fs.readdirSync(path.join(componentsDir, entry.name));
    for (const subEntry of subEntries) {
      const oldAbs = path.join(componentsDir, entry.name, subEntry);
      const newAbs = path.join(componentsDir, 'users', subEntry);
      oldToNew.set(oldAbs, newAbs);
      
      // Also map without extension
      const ext = path.extname(subEntry);
      if (ext) {
        oldToNew.set(
          path.join(componentsDir, entry.name, subEntry.replace(ext, '')),
          path.join(componentsDir, 'users', subEntry.replace(ext, ''))
        );
      }
    }
    continue; // We mapped its contents, the directory itself will be removed later
  }

  const folder = getDestinationFolder(entry.name);
  if (folder) {
    const oldAbs = path.join(componentsDir, entry.name);
    const newAbs = path.join(componentsDir, folder, entry.name);
    oldToNew.set(oldAbs, newAbs);
    
    // Also map without extension for import resolution
    const ext = path.extname(entry.name);
    if (ext) {
      oldToNew.set(
        path.join(componentsDir, entry.name.replace(ext, '')),
        path.join(componentsDir, folder, entry.name.replace(ext, ''))
      );
    }
  }
}

// Helper to get all files in src
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      if (['.js', '.jsx', '.css', '.ts', '.tsx'].includes(path.extname(filePath))) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allSrcFiles = getAllFiles(srcDir);

// Function to calculate new relative import path
function getNewRelativeImport(importStr, fileOldAbsPath, fileNewAbsPath) {
  if (!importStr.startsWith('.')) return importStr;

  const targetOldAbsPath = path.resolve(path.dirname(fileOldAbsPath), importStr);
  
  let targetNewAbsPath = oldToNew.get(targetOldAbsPath);
  
  if (!targetNewAbsPath) {
    targetNewAbsPath = targetOldAbsPath;
  }

  let newRelPath = path.relative(path.dirname(fileNewAbsPath), targetNewAbsPath);
  
  if (!newRelPath.startsWith('.')) {
    newRelPath = './' + newRelPath;
  }
  
  return newRelPath.replace(/\\/g, '/');
}

// 2. Process all files to update imports
const filesToUpdate = new Map(); // fileOldAbsPath -> new content

for (const fileOldAbs of allSrcFiles) {
  const ext = path.extname(fileOldAbs);
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    let content = fs.readFileSync(fileOldAbs, 'utf8');
    const fileNewAbs = oldToNew.get(fileOldAbs) || fileOldAbs;
    
    let changed = false;
    
    const importRegex = /(import|export)([\s\S]*?from\s+)?(['"])([^'"]+)\3/g;
    
    content = content.replace(importRegex, (match, p1, p2, quote, importPath) => {
      if (importPath.startsWith('.')) {
        const newImportPath = getNewRelativeImport(importPath, fileOldAbs, fileNewAbs);
        if (newImportPath !== importPath) {
          changed = true;
          return `${p1}${p2 || ''}${quote}${newImportPath}${quote}`;
        }
      }
      return match;
    });

    const dynamicImportRegex = /import\((['"])([^'"]+)\1\)/g;
    content = content.replace(dynamicImportRegex, (match, quote, importPath) => {
      if (importPath.startsWith('.')) {
        const newImportPath = getNewRelativeImport(importPath, fileOldAbs, fileNewAbs);
        if (newImportPath !== importPath) {
          changed = true;
          return `import(${quote}${newImportPath}${quote})`;
        }
      }
      return match;
    });

    if (changed || fileNewAbs !== fileOldAbs) {
      filesToUpdate.set(fileOldAbs, { newAbs: fileNewAbs, content });
    }
  } else if (ext === '.css') {
    const fileNewAbs = oldToNew.get(fileOldAbs) || fileOldAbs;
    if (fileNewAbs !== fileOldAbs) {
        let content = fs.readFileSync(fileOldAbs, 'utf8');
        filesToUpdate.set(fileOldAbs, { newAbs: fileNewAbs, content });
    }
  }
}

// 3. Create directories, write files, delete old files
for (const folder of Object.keys(mappings)) {
  const dirPath = path.join(componentsDir, folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const oldFilesToDelete = [];

for (const [oldAbs, data] of filesToUpdate.entries()) {
  if (oldAbs !== data.newAbs) {
    oldFilesToDelete.push(oldAbs);
  }
  fs.writeFileSync(data.newAbs, data.content, 'utf8');
}

// Delete old files
for (const oldAbs of oldFilesToDelete) {
  if (fs.existsSync(oldAbs)) {
    fs.unlinkSync(oldAbs);
  }
}

// Cleanup UserManagement old directory
const oldUserMgmtDir = path.join(componentsDir, 'UserManagement');
if (fs.existsSync(oldUserMgmtDir)) {
  const remaining = fs.readdirSync(oldUserMgmtDir);
  if (remaining.length === 0) {
    fs.rmdirSync(oldUserMgmtDir);
  } else {
    console.log(`Warning: ${oldUserMgmtDir} is not empty. Left behind:`, remaining);
  }
}

console.log('Reorganization complete.');
