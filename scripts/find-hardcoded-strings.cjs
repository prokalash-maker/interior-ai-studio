const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== 'locales') {
        results = results.concat(walk(full));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('src');
const cyrillicRegex = /[\u0400-\u04FF]/;

for (const file of files) {
  if (file.includes('locales')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    if (cyrillicRegex.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('/*') && !l.trim().startsWith('*')) {
      hits.push({ line: i + 1, text: l.trim() });
    }
  });
  if (hits.length > 0) {
    console.log(`\nFile: ${file} (${hits.length} hardcoded Cyrillic lines):`);
    hits.slice(0, 5).forEach(h => console.log(`  L${h.line}: ${h.text.substring(0, 80)}`));
    if (hits.length > 5) console.log(`  ... and ${hits.length - 5} more`);
  }
}
