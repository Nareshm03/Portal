import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { HttpError } from './utils/httpError.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { apiRouter } from './routes/api.js';
import { webhookRouter } from './routes/webhooks.js';
import { conversationRouter } from './routes/conversations.js';
import { uploadRouter } from './routes/uploads.js';

export const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);

app.use(requestId);
app.use(pinoHttp({ logger, customProps: (req) => ({ requestId: req.id }), quietReqLogger: true }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.appOrigins.includes(origin)) return callback(null, true);
    return callback(new HttpError(403, 'CORS_ORIGIN_FORBIDDEN', 'This origin is not allowed to access the API.'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id', 'X-Razorpay-Signature', 'X-Razorpay-Event-Id'],
  maxAge: 600
}));

// Webhooks must be read as exact raw bytes for HMAC verification; mount before JSON parsing.
app.use('/api/v1/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), webhookRouter);
app.use(express.json({ limit: '100kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

const generalLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } } });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sensitive requests. Try again later.' } } });
app.use('/api/v1', generalLimiter);
app.use('/api/v1/payments', authLimiter);
app.use('/api/v1/kyc', authLimiter);
app.use('/api/v1', apiRouter);
app.use('/api/v1', conversationRouter);
app.use('/api/v1', uploadRouter);
app.use(notFound);
app.use(errorHandler);
