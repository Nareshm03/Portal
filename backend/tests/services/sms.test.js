/**
 * Unit tests for the MSG91 SMS delivery service (src/services/sms.js).
 *
 * All MSG91 HTTP requests are mocked via globalThis.fetch. No real SMS is sent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { sendOtpSms, maskMobile } from '../../src/services/sms.js';

const AUTH_KEY = 'test-msg91-auth-key-12345';
const TEMPLATE_ID = 'template-msg91-otp-67890';
const MOBILE = '+919876543210';
const OTP = '123456';

function mockFetch(responseBody, status = 200, contentType = 'application/json') {
  const body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name === 'content-type' ? contentType : null },
    text: async () => body,
  });
}

function mockFetchError(error) {
  globalThis.fetch = async () => {
    throw error;
  };
}

function mockFetchTimeout() {
  globalThis.fetch = async () => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      }, 50);
    });
  };
}

test('sendOtpSms: successful delivery returns success with messageId', async (t) => {
  mockFetch({ type: 'success', message: 'OTP sent', messageId: 'msg_12345' });
  const result = await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(result.success, true);
  assert.equal(result.messageId, 'msg_12345');
  assert.equal(result.error, undefined);
});

test('sendOtpSms: correct OTP is passed to provider', async (t) => {
  let sentBody = null;
  globalThis.fetch = async (url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ type: 'success', message: 'OK' }),
    };
  };
  await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(sentBody.otp, OTP);
  assert.equal(sentBody.mobile, MOBILE);
  assert.equal(sentBody.template_id, TEMPLATE_ID);
});

test('sendOtpSms: correct auth key header is sent', async (t) => {
  let sentHeaders = null;
  globalThis.fetch = async (url, options) => {
    sentHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ type: 'success', message: 'OK' }),
    };
  };
  await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(sentHeaders.authkey, AUTH_KEY);
  assert.equal(sentHeaders['content-type'], 'application/json');
});

test('sendOtpSms: missing auth key throws 503', async (t) => {
  await assert.rejects(
    sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: '', templateId: TEMPLATE_ID }),
    (err) => err.statusCode === 503 && err.code === 'MSG91_AUTH_KEY_MISSING'
  );
});

test('sendOtpSms: missing template ID throws 503', async (t) => {
  await assert.rejects(
    sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: '' }),
    (err) => err.statusCode === 503 && err.code === 'MSG91_TEMPLATE_ID_MISSING'
  );
});

test('sendOtpSms: invalid mobile throws 400', async (t) => {
  await assert.rejects(
    sendOtpSms({ mobile: 'invalid', otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_PHONE_NUMBER'
  );
});

test('sendOtpSms: invalid OTP throws 400', async (t) => {
  await assert.rejects(
    sendOtpSms({ mobile: MOBILE, otp: '123', authKey: AUTH_KEY, templateId: TEMPLATE_ID }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_OTP'
  );
});

test('sendOtpSms: provider authentication failure returns failure', async (t) => {
  mockFetch({ type: 'error', message: 'Authentication failed' }, 401);
  const result = await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Authentication failed');
});

test('sendOtpSms: provider timeout returns failure', async (t) => {
  mockFetchTimeout();
  const result = await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(result.success, false);
  assert.equal(result.error, 'PROVIDER_TIMEOUT');
});

test('sendOtpSms: provider rejection returns failure', async (t) => {
  mockFetch({ type: 'error', message: 'Invalid template ID' }, 400);
  const result = await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid template ID');
});

test('sendOtpSms: network error returns failure', async (t) => {
  mockFetchError(new TypeError('Network error'));
  const result = await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(result.success, false);
  assert.equal(result.error, 'PROVIDER_ERROR');
});

test('maskMobile: masks E.164 number showing only last 4 digits', () => {
  assert.equal(maskMobile('+919876543210'), '+xxxxxxxx3210');
  assert.equal(maskMobile('+14155552671'), '+xxxxxxx2671');
});

test('maskMobile: handles invalid input gracefully', () => {
  assert.equal(maskMobile(''), '');
  assert.equal(maskMobile('+12345'), '+x2345');
});

test('sendOtpSms: uses HTTPS endpoint', async (t) => {
  let sentUrl = null;
  globalThis.fetch = async (url) => {
    sentUrl = url;
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ type: 'success', message: 'OK' }),
    };
  };
  await sendOtpSms({ mobile: MOBILE, otp: OTP, authKey: AUTH_KEY, templateId: TEMPLATE_ID });
  assert.equal(sentUrl, 'https://control.msg91.com/api/v5/otp');
});
