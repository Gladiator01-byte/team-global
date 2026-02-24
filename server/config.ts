import "dotenv/config";

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
};

export const config = {
  jwtSecret: required("NONCE_JWT_SECRET", "dev-nonce-secret"),
  nonceMinLifetimeSec: Number(process.env.NONCE_MIN_LIFETIME_SEC ?? 30),
  nonceMaxLifetimeSec: Number(process.env.NONCE_MAX_LIFETIME_SEC ?? 60),
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  realtimeChannel: process.env.NONCE_REALTIME_CHANNEL ?? "nonce-updates"
};
