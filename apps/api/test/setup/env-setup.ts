import { inject } from 'vitest';

// Runs before each test file is imported: point the app at the ephemeral test database.
process.env.DATABASE_URL = inject('databaseUrl');
