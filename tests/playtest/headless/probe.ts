// Probe: what breaks when we import turnManager?
try {
  console.log('Attempting import...');
  const tm = await import('../../../src/services/turnManager');
  console.log('SUCCESS! Functions:', Object.keys(tm));
} catch (err) {
  console.log('FAILED:', (err as Error).message?.slice(0, 200));
}
