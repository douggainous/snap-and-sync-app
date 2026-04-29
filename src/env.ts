const requiredClientEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export function assertClientEnv() {
  const missing = requiredClientEnv.filter((key) => !import.meta.env[key]);

  if (missing.length) {
    document.body.innerHTML = `<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif"><section style="max-width:420px;border:1px solid #ddd;border-radius:16px;padding:24px;text-align:center"><h1>App configuration missing</h1><p>The app could not start because required environment variables are unavailable.</p><p style="font-size:12px;color:#666">Missing: ${missing.join(", ")}</p></section></main>`;
    throw new Error(`Missing required frontend environment variables: ${missing.join(", ")}`);
  }
}