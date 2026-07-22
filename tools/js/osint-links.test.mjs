import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildLinkSections, normalizeInputs, validateStateData } from './osint-links.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stateData = JSON.parse(readFileSync(join(__dirname, '../state_data.json'), 'utf8'));

let failed = 0;
function assert(name, cond, detail = '') {
  if (!cond) {
    console.error('FAIL', name, detail);
    failed++;
  } else {
    console.log('PASS', name, detail);
  }
}

const v = validateStateData(stateData);
assert('validateStateData ok', v.ok);

const min = buildLinkSections({ orgName: 'Happy Paws' }, stateData);
assert('min has financial', min.some((s) => s.id === 'financial'));
assert('min section count', min.length >= 4, String(min.map((s) => s.id)));

const withEin = buildLinkSections({ orgName: 'X', orgEin: '12-3456789' }, stateData);
const pp = withEin.find((s) => s.id === 'financial').links.find((l) => l.name.includes('ProPublica'));
assert('EIN path', pp.url.endsWith('/organizations/123456789'), pp.url);

const pr = buildLinkSections({ orgName: 'PR Org', selectedState: 'PR' }, stateData);
assert('PR state', pr.some((s) => s.id === 'state') && pr.some((s) => s.id === 'state-animal'));

const full = buildLinkSections({
  orgName: 'Acme',
  personName: 'Jane',
  orgEin: '98-7654321',
  location: 'Austin, TX',
  domainName: 'https://www.acme.org/',
  socialHandle: '@acme',
  selectedState: 'TX',
}, stateData);
const ids = full.map((s) => s.id);
assert('full sections', ['personnel', 'advanced', 'social-deep', 'legal'].every((id) => ids.includes(id)), ids.join(','));

const ctx = normalizeInputs({ domainName: 'https://www.Example.COM/path/', socialHandle: '@Foo' });
assert('domain normalize', ctx.domain === 'Example.COM/path' || ctx.domain === 'Example.COM/path'.replace(/\/$/, ''), ctx.domain);
assert('handle normalize', ctx.handle === 'Foo', ctx.handle);

assert('reject empty', !validateStateData({}).ok);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll osint-links tests passed');
