// The names and sample count scripts/shapes.js generates, read back out of
// the generated partial so the test and the generator cannot drift apart.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', '_shape-library.scss'), 'utf8');
const shapes = [...src.matchAll(/"([a-z0-9-]+)": polygon\(([^)]*)\),/g)].map(([, name, body]) => ({
  name,
  points: body.split(',').length,
}));

module.exports = { shapes, count: shapes.length };
