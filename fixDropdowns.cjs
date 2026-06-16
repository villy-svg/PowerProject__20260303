const fs = require('fs');
const path = require('path');

const files = [
  "src/verticals/ChargingHubs/HubManagement.jsx",
  "src/verticals/ChargingHubs/HubFunctionManagement.jsx",
  "src/verticals/Clients/ClientCategoryManagement.jsx",
  "src/verticals/Clients/ClientServiceManagement.jsx",
  "src/verticals/Clients/ClientBillingModelManagement.jsx",
  "src/verticals/Employees/DepartmentManagement.jsx",
  "src/verticals/Employees/EmployeeRoleManagement.jsx"
];

for (const file of files) {
  const fullPath = path.resolve(file);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Add state
  if (!content.includes('isActionsDropdownOpen')) {
    content = content.replace(/(const \[statusMsg, setStatusMsg\] = useState\([^)]*\);)/, '$1\n  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);');
  }

  // Add import
  if (!content.includes('IconChevronDown')) {
    if (content.includes("from '../../components/Icons'")) {
       content = content.replace(/import\s+{([^}]*)}\s+from\s+'\.\.\/\.\.\/components\/Icons';/, (match, p1) => {
         return `import { ${p1.trim()}, IconChevronDown } from '../../components/Icons';`;
       });
    } else {
       content = content.replace(/(import MasterPageHeader from '\.\.\/\.\.\/components\/MasterPageHeader';)/, "$1\nimport { IconChevronDown } from '../../components/Icons';");
    }
  }

  // Replace expandedRight
  const regex = /expandedRight={\s*<>\s*([\s\S]*?)\s*<\/>\s*}/;
  const match = content.match(regex);
  if (match && !match[0].includes('data-operations-wrapper')) {
     const innerButtons = match[1].trim();
     const replacement = `expandedRight={
          <>
            <div className="data-operations-wrapper">
              <div className="actions-dropdown-container">
                <div
                  className="filters-row-toggle"
                  onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                >
                  <p style={{ textTransform: 'uppercase' }}>Data Operations</p>
                  <span style={{ transform: isActionsDropdownOpen ? 'rotate(180deg)' : 'none', opacity: 0.5, transition: 'transform 0.2s ease', display: 'flex', alignItems: 'center' }}>
                    <IconChevronDown size={10} />
                  </span>
                </div>
                {isActionsDropdownOpen && (
                  <div className="actions-dropdown-menu">
                    ${innerButtons.split('\\n').join('\\n                    ')}
                  </div>
                )}
              </div>
            </div>
          </>
        }`;
     content = content.replace(regex, replacement);
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${file}`);
}
