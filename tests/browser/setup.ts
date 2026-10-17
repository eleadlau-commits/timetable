export default async function setup() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(3000) });
      if (response.ok && (await response.json()).ready) return;
    } catch { /* The container may still be checking hashes or OTP loading. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Backend did not become ready. Start Docker services and check /api/health.');
}
