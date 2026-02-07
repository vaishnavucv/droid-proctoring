import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ success: false, message: 'Username and password are required' }, { status: 400 });
        }

        const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (res.rows.length > 0) {
            const user = res.rows[0];
            if (user.password === password) {
                return NextResponse.json({
                    success: true,
                    userId: user.user_id,
                    username: user.username
                });
            }
        }

        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
