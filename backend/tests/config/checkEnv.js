/**
 * Isolated environment validation script for child-process testing.
 *
 * Imports src/config/env.js and prints ENV_VALID on success.
 * Any validation error thrown by env.js causes a non-zero exit code
 * with the error message on stderr.
 */

import { env } from '../../src/config/env.js';

// If we reach here, env.js loaded without throwing.
console.log('ENV_VALID');
console.log(`NODE_ENV=${env.NODE_ENV}`);
