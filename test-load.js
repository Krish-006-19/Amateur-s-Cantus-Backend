try {
  require('./index.js');
  console.log('Backend loaded OK');
} catch (e) {
  console.error('Load error:', e.message);
  process.exit(1);
}
