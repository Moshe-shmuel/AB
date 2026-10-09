import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ directory not found. Run "npm run build" first.');
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });

let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// 1. Inline all local CSS <link rel="stylesheet" ... href="...">
html = html.replace(
  /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
  (fullMatch, href) => {
    const cleanPath = href.replace(/^\//, '');
    const cssFile = path.join(distDir, cleanPath);
    if (fs.existsSync(cssFile)) {
      const cssContent = fs.readFileSync(cssFile, 'utf-8');
      return `<style>\n${cssContent}\n</style>`;
    }
    return fullMatch;
  }
);

// 2. Inline all local JS <script ... src="..."></script>
html = html.replace(
  /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
  (fullMatch, src) => {
    const cleanPath = src.replace(/^\//, '');
    const jsFile = path.join(distDir, cleanPath);
    if (fs.existsSync(jsFile)) {
      const jsContent = fs
        .readFileSync(jsFile, 'utf-8')
        .replace(/<\/script>/gi, '<\\/script>');
      return `<script type="module">\n${jsContent}\n</script>`;
    }
    return fullMatch;
  }
);

// 3. Write standalone single-file HTML
const singleHtmlPath = path.join(releaseDir, 'Budget-Maaser-Pro-SingleFile.html');
fs.writeFileSync(singleHtmlPath, '\ufeff' + html, 'utf-8');

// 4. Write standalone Windows Desktop Application (.hta) with HTA header injected in <head>
const htaHeader = `
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <HTA:APPLICATION
      ID="BudgetMaaserProApp"
      APPLICATIONNAME="כלכלת הבית ומעשרות Pro"
      BORDER="thick"
      BORDERSTYLE="normal"
      CAPTION="yes"
      MAXIMIZEBUTTON="yes"
      MINIMIZEBUTTON="yes"
      SHOWINTASKBAR="yes"
      SINGLEINSTANCE="yes"
      SYSMENU="yes"
      VERSION="2.0"
      WINDOWSTATE="maximize"
    />`;

const htaContent = html.replace('<head>', `<head>${htaHeader}`);
const singleHtaPath = path.join(releaseDir, 'Budget-Maaser-Pro-Desktop.hta');
fs.writeFileSync(singleHtaPath, '\ufeff' + htaContent, 'utf-8');

console.log('✅ Single-file bundle created successfully:');
console.log('   -', singleHtmlPath);
console.log('   -', singleHtaPath);
