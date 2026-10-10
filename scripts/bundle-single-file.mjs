import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

// 1. Inline all local CSS <link ... rel="stylesheet" ... href="...">
html = html.replace(
  /<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi,
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

// 2. Extract and inline all local JS <script ... src="..."></script> and place right before </body>
// IMPORTANT: Use a function callback in .replace() so '$&' and "$'" in minified React code are NEVER mutated!
const inlineScripts = [];
html = html.replace(
  /<script\b[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi,
  (fullMatch, src) => {
    const cleanPath = src.replace(/^\//, '');
    const jsFile = path.join(distDir, cleanPath);
    if (fs.existsSync(jsFile)) {
      const jsContent = fs
        .readFileSync(jsFile, 'utf-8')
        .replace(/<\/script>/gi, '<\\/script>');
      inlineScripts.push(`<script>\n${jsContent}\n</script>`);
      return '';
    }
    return fullMatch;
  }
);

if (inlineScripts.length > 0) {
  const scriptsBlock = inlineScripts.join('\n');
  html = html.replace(/<\/body>/i, () => `${scriptsBlock}\n  </body>`);
}

// 3. Write standalone single-file HTML
const singleHtmlPath = path.join(releaseDir, 'Budget-Maaser-Pro-SingleFile.html');
fs.writeFileSync(singleHtmlPath, '\ufeff' + html, 'utf-8');

console.log('✅ Single-file HTML created successfully:');
console.log('   -', singleHtmlPath);

// 4. On Windows (including GitHub Actions windows-latest), compile real native Windows .EXE
const csSourcePath = path.join(__dirname, 'DesktopLauncher.cs');
const exeOutputPath = path.join(releaseDir, 'Budget-Maaser-Pro.exe');

const cscCandidates = [
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
];

const cscPath = cscCandidates.find((p) => fs.existsSync(p));

if (cscPath && fs.existsSync(csSourcePath)) {
  try {
    execFileSync(
      cscPath,
      [
        '/nologo',
        '/target:winexe',
        '/optimize+',
        `/out:${exeOutputPath}`,
        `/resource:${singleHtmlPath},BudgetMaaserPro.SingleFile.html`,
        '/r:System.dll',
        '/r:System.Windows.Forms.dll',
        '/r:System.Drawing.dll',
        csSourcePath,
      ],
      { stdio: 'inherit' }
    );
    console.log('✅ Real Windows Desktop .EXE compiled successfully:');
    console.log('   -', exeOutputPath);
  } catch (err) {
    console.error('❌ Failed to compile Windows .EXE with csc.exe:', err);
    process.exit(1);
  }
} else {
  console.log(
    'ℹ️ Windows csc.exe not found on this OS (running on Linux/macOS). GitHub Actions (windows-latest) will compile release/Budget-Maaser-Pro.exe automatically.'
  );
}
