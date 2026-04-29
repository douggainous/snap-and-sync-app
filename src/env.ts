const requiredClientEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export function assertClientEnv() {
  const missing = requiredClientEnv.filter((key) => !import.meta.env[key]);

  if (missing.length) {
    throw new Error(`Missing required frontend environment variables: ${missing.join(", ")}`);
  }
}