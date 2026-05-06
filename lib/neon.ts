import { neon } from '@neondatabase/serverless'

// Use the HTTP client
// Provide a dummy connection string during next build if DATABASE_URL is missing
export const sql = neon(process.env.DATABASE_URL || 'postgresql://user:pass@localhost/db')
