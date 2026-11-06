import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'headers.authorization',
      '*.password', '*.token', '*.secret', '*.otp', '*.phone', '*.email',
      '*.passport', '*.passport_number', '*.document_url', '*.service_role_key'
    ],
    censor: '[REDACTED]'
  },
  base: { service: 'portal-api', environment: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime
});
