import { execSync } from 'child_process';
import fs from 'fs';

try {
  execSync('npx eslint -f json . > lint.json', { encoding: 'utf-8', stdio: 'pipe' });
} catch (e) {}

try {
  execSync('npx vite build', { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('build.txt', 'Build succeeded');
} catch (e) {
  fs.writeFileSync('build.txt', (e.stdout || '') + (e.stderr || ''));
}
