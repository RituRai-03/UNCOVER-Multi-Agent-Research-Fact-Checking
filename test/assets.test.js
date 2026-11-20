import fs from 'fs';
import path from 'path';

const htmlFiles = ['index.html', 'history.html', 'workspace.html', 'report.html', 'dashboard.html'];
let issues = 0;

htmlFiles.forEach(file => {
  const filePath = path.join('public', file);
  if (!fs.existsSync(filePath)) {
    console.error('Missing file:', filePath);
    issues++;
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  // Check script tags
  const scriptRegex = /src=["']([^"']+)["']/g;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1];
    if (!src.startsWith('http') && !src.startsWith('//')) {
      const fullPath = path.join('public', src);
      if (!fs.existsSync(fullPath)) {
        console.error(`Broken script src in ${file}: ${src}`);
        issues++;
      }
    }
  }

  // Check CSS links
  const cssRegex = /href=["']([^"']+\.css)["']/g;
  while ((match = cssRegex.exec(content)) !== null) {
    const href = match[1];
    if (!href.startsWith('http') && !href.startsWith('//')) {
      const fullPath = path.join('public', href);
      if (!fs.existsSync(fullPath)) {
        console.error(`Broken CSS href in ${file}: ${href}`);
        issues++;
      }
    }
  }
});

if (issues === 0) {
  console.log('✓ All HTML files, script modules, and stylesheets verified intact!');
} else {
  console.error(`Found ${issues} broken asset references.`);
  process.exit(1);
}
