import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve .env relative to this file's own location (src/config/env.js → ../../.env at project root).
// This makes env loading stable regardless of the terminal's current working directory.
// CWD-relative resolution is retained as a fallback so that host-injected test overrides
// (e.g. NODE_ENV=test node src/index.js from a different path) continue to work.
const __dir = dirname(fileURLToPath(import.meta.url));
const envFile = (() => {
  const moduleRelative = resolve(__dir, '../../../.env');
  if (existsSync(moduleRelative)) return moduleRelative;
  return resolve(process.cwd(), '.env');
})();
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
const mockMessaging = bool('MOCK_MESSAGING', true);
const paymentsEnabled = bool('PAYMENTS_ENABLED', false);
const otpPepper = value('OTP_PEPPER', 'development-only-change-this-otp-pepper-32chars');
const supabaseUrl = optional('SUPABASE_URL');
const supabaseServiceRoleKey = optional('SUPABASE_SERVICE_ROLE_KEY');
const otpProvider = value('OTP_PROVIDER', 'mock');
const msg91AuthKey = optional('MSG91_AUTH_KEY');
const msg91OtpTemplateId = optional('MSG91_OTP_TEMPLATE_ID');
const useTestMode = value('RAZORPAY_USE_TEST_MODE', 'false') === 'true';
if (nodeEnv === 'production') {
  if (!supabaseUrl || !/^https:\/\//.test(supabaseUrl) || !supabaseServiceRoleKey) throw new Error('Production requires HTTPS SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  if (otpPepper.length < 32 || otpPepper.startsWith('development-only')) throw new Error('Production requires a strong OTP_PEPPER.');
  if (mockPayments) throw new Error('MOCK_PAYMENTS must be false in production.');
  if (mockMessaging) throw new Error('MOCK_MESSAGING must be false in production. Use Supabase-backed messaging.');
  // Razorpay test mode is NEVER allowed in production.
  if (useTestMode) {
    throw new Error('RAZORPAY_USE_TEST_MODE is not allowed in production. Use live credentials with PAYMENTS_ENABLED=true.');
  }
  // Production must use a real OTP provider; mock delivery is never allowed.
  if (otpProvider === 'mock') {
    throw new Error('OTP_PROVIDER must not be "mock" in production. Set OTP_PROVIDER=msg91 and configure MSG91 credentials.');
  }
  if (otpProvider === 'msg91') {
    if (!msg91AuthKey) throw new Error('MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91.');
    if (!msg91OtpTemplateId) throw new Error('MSG91_OTP_TEMPLATE_ID is required when OTP_PROVIDER=msg91.');
  }
}
// When test mode is enabled outside production, verify the Test Key ID prefix.
if (useTestMode) {
  const testKeyId = optional('RAZORPAY_TEST_KEY_ID');
  if (testKeyId && !testKeyId.startsWith('rzp_test_')) {
    throw new Error('RAZORPAY_TEST_KEY_ID must start with "rzp_test_" prefix.');
  }
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
  MOCK_MESSAGING: mockMessaging,
  PAYMENTS_ENABLED: paymentsEnabled,
  RAZORPAY_KEY_ID: optional('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: optional('RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: optional('RAZORPAY_WEBHOOK_SECRET'),
  RAZORPAY_TEST_KEY_ID: optional('RAZORPAY_TEST_KEY_ID'),
  RAZORPAY_TEST_KEY_SECRET: optional('RAZORPAY_TEST_KEY_SECRET'),
  RAZORPAY_TEST_WEBHOOK_SECRET: optional('RAZORPAY_TEST_WEBHOOK_SECRET'),
  RAZORPAY_USE_TEST_MODE: optional('RAZORPAY_USE_TEST_MODE'),
  OTP_PEPPER: otpPepper,
  OTP_PROVIDER: otpProvider,
  MSG91_AUTH_KEY: msg91AuthKey,
  MSG91_OTP_TEMPLATE_ID: msg91OtpTemplateId,
  PLATFORM_FEE_BPS: int('PLATFORM_FEE_BPS', 500, 0, 3000),
  BUYER_DEPOSIT_BPS: int('BUYER_DEPOSIT_BPS', 2500, 1, 10000),
  QUOTE_TTL_MINUTES: int('QUOTE_TTL_MINUTES', 15, 1, 1440),
  ORDER_PAYMENT_TTL_MINUTES: int('ORDER_PAYMENT_TTL_MINUTES', 15, 1, 120),
  FX_PROVIDER: value('FX_PROVIDER', 'manual'),
  FX_RATE_TABLE_JSON: value('FX_RATE_TABLE_JSON', '{}'),
  FX_RATE_SOURCE: value('FX_RATE_SOURCE', 'ENV_CONFIG'),
  appOrigins: value('APP_ORIGINS', 'http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean),
  fxRateTable,
  // Background job scheduling
  JOBS_ENABLED: bool('JOBS_ENABLED', false),
  EXPIRE_ORDERS_INTERVAL_MINUTES: int('EXPIRE_ORDERS_INTERVAL_MINUTES', 5, 1, 1440),
  RECONCILE_PAYMENTS_INTERVAL_MINUTES: int('RECONCILE_PAYMENTS_INTERVAL_MINUTES', 15, 1, 1440),
  JOBS_LOCK_TTL_MINUTES: int('JOBS_LOCK_TTL_MINUTES', 10, 1, 1440),
  JOBS_LOCK_DIR: optional('JOBS_LOCK_DIR'),
});
