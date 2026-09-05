// npm test: contrast and the token-namespace contract (static), then the
// Chromium audits, hit-area, icon, shape-morph and M3 spec-conformance checks.
const suites = [['contrast', require('./contrast')], ['namespace', require('./namespace')], ['audit', require('./audit')], ['hit-areas', require('./hit-areas')], ['icon', require('./icon')], ['morph', require('./morph')], ['spec', require('./spec')], ['cascade', require('./cascade')], ['shape', require('./shape')], ['equivalence', require('./equivalence')]];
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
