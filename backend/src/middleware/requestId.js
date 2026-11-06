import { randomUUID } from 'node:crypto';
export function requestId(req, res, next) {
  const supplied = req.get('x-request-id');
  req.id = supplied && /^[A-Za-z0-9._-]{8,80}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
