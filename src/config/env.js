import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Small dotenv-compatible loader using Node core only (does not override host-injected env vars).
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const value = (key, fallback) => process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key];
const bool = (key, fallback) => String(value(key, String(fallback))).toLowerCase() === 'true';
const int = (key, fallback, min, max) => {
  const parsed = Number(value(key, String(fallback)));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Invalid environment setting: ${key}`);
  return parsed;
};
const optional = (key) => process.env[key] || undefined;
const nodeEnv = value('NODE_ENV', 'development');
if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test or production.');

let fxRateTable;
try { fxRateTable = JSON.parse(value('FX_RATE_TABLE_JSON', '{}')); }
catch { throw new Error('FX_RATE_TABLE_JSON must be valid JSON.'); }
if (!fxRateTable || typeof fxRateTable !== 'object' || Array.isArray(fxRateTable)) throw new Error('FX_RATE_TABLE_JSON must be an object.');

const mockPayments = bool('MOCK_PAYMENTS', true);
const paymentsEnabled = bool('PAYMENTS_ENABLED', false);
const otpPepper = value('OTP_PEPPER', 'development-only-change-this-otp-pepper-32chars');
const supabaseUrl = optional('SUPABASE_URL');
const supabaseServiceRoleKey = optional('SUPABASE_SERVICE_ROLE_KEY');
if (nodeEnv === 'production') {
  if (!supabaseUrl || !/^https:\/\//.test(supabaseUrl) || !supabaseServiceRoleKey) throw new Error('Production requires HTTPS SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  if (otpPepper.length < 32 || otpPepper.startsWith('development-only')) throw new Error('Production requires a strong OTP_PEPPER.');
  if (mockPayments) throw new Error('MOCK_PAYMENTS must be false in production.');
}
if (paymentsEnabled && mockPayments) throw new Error('PAYMENTS_ENABLED cannot be true while MOCK_PAYMENTS is true.');

export const env = Object.freeze({
  NODE_ENV: nodeEnv,
  PORT: int('PORT', 4000, 1, 65535),
  APP_ORIGINS: value('APP_ORIGINS', 'http://localhost:3000'),
  TRUST_PROXY_HOPS: int('TRUST_PROXY_HOPS', 0, 0, 5),
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
  MOCK_PAYMENTS: mockPayments,
  PAYMENTS_ENABLED: paymentsEnabled,
  RAZORPAY_KEY_ID: optional('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: optional('RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: optional('RAZORPAY_WEBHOOK_SECRET'),
  OTP_PEPPER: otpPepper,
  PLATFORM_FEE_BPS: int('PLATFORM_FEE_BPS', 500, 0, 3000),
  BUYER_DEPOSIT_BPS: int('BUYER_DEPOSIT_BPS', 2500, 1, 10000),
  QUOTE_TTL_MINUTES: int('QUOTE_TTL_MINUTES', 15, 1, 1440),
  ORDER_PAYMENT_TTL_MINUTES: int('ORDER_PAYMENT_TTL_MINUTES', 15, 1, 120),
  FX_PROVIDER: value('FX_PROVIDER', 'manual'),
  FX_RATE_TABLE_JSON: value('FX_RATE_TABLE_JSON', '{}'),
  FX_RATE_SOURCE: value('FX_RATE_SOURCE', 'ENV_CONFIG'),
  appOrigins: value('APP_ORIGINS', 'http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean),
  fxRateTable
});
