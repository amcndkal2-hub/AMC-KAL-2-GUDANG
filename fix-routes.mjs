import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesPath = join(__dirname, 'dist', '_routes.json');

try {
  const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
  
  const extraExcludes = ['/url-redirect.js'];
  for (const ex of extraExcludes) {
    if (!routes.exclude.includes(ex)) {
      routes.exclude.push(ex);
    }
  }
  
  writeFileSync(routesPath, JSON.stringify(routes));
  console.log('✅ Updated _routes.json:', JSON.stringify(routes));
} catch (e) {
  console.error('❌ Failed to update _routes.json:', e.message);
}
