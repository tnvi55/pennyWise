// Runs before every unit and e2e test file.

// Decorators from class-validator/class-transformer read type metadata via the
// Reflect API. In the real app @nestjs/core loads this polyfill; tests that import
// a DTO directly need it loaded first.
import 'reflect-metadata';

// Synthetic environment. Values already set in the real environment (e.g. by CI)
// are kept, so a test run never needs a .env file.
process.env.NODE_ENV ??= 'test';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.PORT ??= '3000';
// Never connected to by the current tests; a real test database arrives in Phase 3.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pennywise_unused?schema=public';
