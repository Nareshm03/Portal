/**
 * Production environment configuration validation tests.
 *
 * Each test spawns an isolated Node.js child process so that environment
 * variable mutations cannot leak into the main test suite or contaminate
 * other tests. The env module is loaded fresh in each child process and
 * throws on invalid production configuration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// tests/config/ -> ../.. -> backend/
const BACKEND_ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = resolve(BACKEND_ROOT, 'tests/config/checkEnv.js');

/**
 * Spawn an isolated child process that imports src/config/env.js.
 * Returns { status, stdout, stderr }.
 */
function spawnEnvCheck(envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  const result = spawnSync('node', [SCRIPT], {
    env,
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
    timeout: 10_000,
  });
  return result;
}

/* ------------------------------------------------------------------ */
/* Invalid production configurations                                  */
/* ------------------------------------------------------------------ */

test('production: missing SUPABASE_URL throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'false',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: non-HTTPS SUPABASE_URL throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'http://insecure.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'false',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: missing SUPABASE_SERVICE_ROLE_KEY throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: '',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'false',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: weak OTP pepper (under 32 chars) throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'short',
    MOCK_PAYMENTS: 'false',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: development-only OTP pepper throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'development-only-change-this-otp-pepper-32chars',
    MOCK_PAYMENTS: 'false',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: MOCK_PAYMENTS=true throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'true',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: PAYMENTS_ENABLED=true alongside MOCK_PAYMENTS=true throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'true',
    PAYMENTS_ENABLED: 'true',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: OTP_PROVIDER=mock throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'false',
    PAYMENTS_ENABLED: 'false',
    OTP_PROVIDER: 'mock',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: OTP_PROVIDER=msg91 without MSG91_AUTH_KEY throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'false',
    PAYMENTS_ENABLED: 'false',
    OTP_PROVIDER: 'msg91',
    MSG91_OTP_TEMPLATE_ID: 'fake-template-id',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

test('production: OTP_PROVIDER=msg91 without MSG91_OTP_TEMPLATE_ID throws', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
    OTP_PEPPER: 'strong-pepper-32-chars-long-enough',
    MOCK_PAYMENTS: 'false',
    PAYMENTS_ENABLED: 'false',
    OTP_PROVIDER: 'msg91',
    MSG91_AUTH_KEY: 'fake-auth-key',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 1, 'process should exit non-zero');
});

/* ------------------------------------------------------------------ */
/* Valid production configuration                                     */
/* ------------------------------------------------------------------ */

test('production: valid configuration loads successfully', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-key-for-testing',
    OTP_PEPPER: 'strong-production-otp-pepper-at-least-32-chars-long',
    MOCK_PAYMENTS: 'false',
    PAYMENTS_ENABLED: 'false',
    OTP_PROVIDER: 'msg91',
    MSG91_AUTH_KEY: 'fake-msg91-auth-key',
    MSG91_OTP_TEMPLATE_ID: 'fake-template-id-12345',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 0, 'process should exit zero');
  assert.ok(result.stdout.includes('ENV_VALID'), 'stdout should confirm valid config');
});

/* ------------------------------------------------------------------ */
/* Non-production environments are lenient                            */
/* ------------------------------------------------------------------ */

test('development: missing SUPABASE_URL does not throw', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'development',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    OTP_PEPPER: 'short',
    MOCK_PAYMENTS: 'true',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 0, 'development should not validate production rules');
  assert.ok(result.stdout.includes('ENV_VALID'), 'stdout should confirm valid config');
});

test('test: missing SUPABASE_URL does not throw', () => {
  const result = spawnEnvCheck({
    NODE_ENV: 'test',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    OTP_PEPPER: 'short',
    MOCK_PAYMENTS: 'true',
    FX_RATE_TABLE_JSON: '{}',
  });
  assert.equal(result.status, 0, 'test environment should not validate production rules');
  assert.ok(result.stdout.includes('ENV_VALID'), 'stdout should confirm valid config');
});
