import { Pool } from 'pg';

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
} else {
    if (!(global as any).postgres) {
        (global as any).postgres = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }
    pool = (global as any).postgres;
}

export default pool;
