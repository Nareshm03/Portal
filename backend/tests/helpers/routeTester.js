/** Route-level test helper: invoke Express route handlers directly.
 *
 * Creates mock `req`/`res` objects and calls `app.handle(req, res)` so the
 * actual Express route handlers are exercised without an HTTP server.
 * A fake Supabase client is injected via `globalThis.__portal_test_db__`.
 *
 * No live database, row locks, or PostgreSQL triggers are exercised.
 */

import { app } from '../../src/app.js';
import { URL } from 'node:url';

export function createRouteTester() {
  const self = {
    /** Invoke a route and return { statusCode, body, headers }. */
    async request(method, path, headers = {}, body = null) {
      // Support query string as second argument with ? prefix
      let pathname = path;
      let queryString = '';

      // Handle path with query string
      if (typeof path === 'string' && path.includes('?')) {
        const [pathPart, queryPart] = path.split('?');
        pathname = pathPart;
        queryString = queryPart;
      }

      // Parse query string into object
      const queryParams = {};
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams.entries()) {
          queryParams[key] = value;
        }
      }

      const fullUrl = `/api/v1${pathname}${queryString ? '?' + queryString : ''}`;

      const mockReq = {
        method,
        url: fullUrl,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
        get(name) { return this.headers[name]?.toString(); },
        body,
        socket: { encrypted: false, remoteAddress: '127.0.0.1' },
        connection: { encrypted: false, remoteAddress: '127.0.0.1' },
        httpVersion: '1.1',
        originalUrl: fullUrl,
        ip: '127.0.0.1',
        ips: [],
        // Expose query params for Express route handlers
        query: queryParams
      };

      let statusCode = 200;
      const responseHeaders = {};
      let responseBody = null;

      const mockRes = {
        statusCode: 200,
        get header() { return responseHeaders; },
        status(code) { statusCode = code; return this; },
        json(data) { responseBody = data; return this; },
        send(data) { responseBody = data; return this; },
        set(name, value) { responseHeaders[name] = value; return this; },
        setHeader(name, value) { responseHeaders[name] = value; return this; },
        removeHeader(name) { delete responseHeaders[name]; return this; },
        getHeader(name) { return responseHeaders[name]; },
        end() { return this; }
      };

      app.handle(mockReq, mockRes);

      // Allow async middleware (route handlers) to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Debug: log if response seems empty
      if (!responseBody && statusCode === 200) {
        console.log('DEBUG: Empty response for', method, path, 'headers:', JSON.stringify(headers));
      }

      return { statusCode, body: responseBody, headers: responseHeaders };
    }
  };

  self.get = (path, headers = {}) => self.request('GET', path, headers);
  self.post = (path, headers = {}, body = null) => self.request('POST', path, headers, body);
  self.patch = (path, headers = {}, body = null) => self.request('PATCH', path, headers, body);

  return self;
}

export function injectDb(db) {
  globalThis.__portal_test_db__ = db;
}
