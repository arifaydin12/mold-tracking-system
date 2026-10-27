// Copies the server's zod schemas (src/validation/schemas.js) into the front end as an ES module so the
// in-browser demo backend validates exactly like the real API. Usage: node scripts/sync-demo-schemas.js
const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'src', 'validation', 'schemas.js');
const target = path.join(__dirname, '..', 'frontend', 'src', 'demo', 'schemas.js');

const header =
    "// GENERATED COPY of src/validation/schemas.js (the server's zod schemas) used by the in-browser demo backend.\n" +
    '// Regenerate with: node scripts/sync-demo-schemas.js  (a unit test fails if the two files drift apart).\n';

const body = fs
    .readFileSync(source, 'utf8')
    .replace("const { z } = require('zod');", "import { z } from 'zod'")
    .replace('module.exports = {', 'export default {');

fs.writeFileSync(target, header + body);
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
