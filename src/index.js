import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'portal_api_started'));

function shutdown(signal) {
  logger.info({ signal }, 'shutdown_started');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'shutdown_failed');
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
