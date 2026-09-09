const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'DragoDocsAI-Website.zip');

const include = [
  'index.html',
  'about.html',
  'privacy.html',
  'terms.html',
  'support.html',
  'contact.html',
  'faq.html',
  'delete-data.html',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'README.md',
  'package.json',
  'assets',
  'scripts',
  'ChatGPT Image 8 jul 2026, 19_26_09.png'
];

const exclude = [
  'node_modules',
  '.venv',
  '.git',
  'package-lock.json',
  'DragoDocsAI-Website.zip'
];

function shouldInclude(filePath, relativePath) {
  const parts = relativePath.split(path.sep);
  if (parts.some(part => exclude.includes(part))) return false;
  if (include.includes(relativePath)) return true;
  if (include.some(item => relativePath.startsWith(item + path.sep))) return true;
  return false;
}

function walk(dir, callback) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(ROOT, fullPath);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (shouldInclude(fullPath, relativePath)) {
        walk(fullPath, callback);
      }
    } else {
      if (shouldInclude(fullPath, relativePath)) {
        callback(fullPath, relativePath);
      }
    }
  });
}

const zip = new AdmZip();

walk(ROOT, (fullPath, relativePath) => {
  const content = fs.readFileSync(fullPath);
  zip.addFile(relativePath.replace(/\\/g, '/'), content);
});

zip.writeZip(OUTPUT);
console.log(`Created ${OUTPUT}`);
console.log(`Size: ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB`);
