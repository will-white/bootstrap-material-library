// npm test: contrast (static), then the Chromium audits, hit-area, icon and shape-morph checks.
const suites = [['contrast', require('./contrast')], ['audit', require('./audit')], ['hit-areas', require('./hit-areas')], ['icon', require('./icon')], ['morph', require('./morph')]];
(async () => {
  const failures = [];
  for (const [name, suite] of suites) {
    try {
      failures.push(...(await suite.run()).map((f) => `${name}: ${f}`));
    } catch (e) {
      failures.push(`${name}: ${e.message}`);
    }
  }
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):\n  ` + failures.join('\n  '));
    process.exit(1);
  }
  console.log('\nall suites passed');
})();
