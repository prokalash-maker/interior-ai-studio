const fs = require('fs');

const ru = fs.readFileSync('src/i18n/locales/ru.ts', 'utf8');
const uk = fs.readFileSync('src/i18n/locales/uk.ts', 'utf8');
const en = fs.readFileSync('src/i18n/locales/en.ts', 'utf8');
const types = fs.readFileSync('src/i18n/types.ts', 'utf8');

function extractKeys(text) {
  const keys = [];
  const lines = text.split('\n');
  for (const l of lines) {
    const m = l.match(/^\s*['"]([^'"]+)['"]\s*:/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

const ruKeys = extractKeys(ru);
const ukKeys = extractKeys(uk);
const enKeys = extractKeys(en);

console.log('RU keys:', ruKeys.length);
console.log('UK keys:', ukKeys.length);
console.log('EN keys:', enKeys.length);

const ruSet = new Set(ruKeys);
const ukSet = new Set(ukKeys);
const enSet = new Set(enKeys);

console.log('Missing in UK:', ruKeys.filter(k => !ukSet.has(k)));
console.log('Missing in EN:', ruKeys.filter(k => !enSet.has(k)));
console.log('Missing in RU:', ukKeys.filter(k => !ruSet.has(k)));

// Check for any hardcoded strings or mojibake in ru / uk / en
function checkMojibake(name, text) {
  const bad = text.match(/[\uFFFD]|(\?\?\?+)/g);
  if (bad) {
    console.log(`Potential mojibake in ${name}: found ${bad.length} occurrences`);
  }
}
checkMojibake('ru', ru);
checkMojibake('uk', uk);
checkMojibake('en', en);
