import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, courseId, maxAttempts } = await request.json();

        if (!userId || !courseId) {
            return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        }

        // Check current attempts
        const statusRes = await pool.query(`
            SELECT attempts_taken FROM user_assessments 
            WHERE user_id = $1 AND course_id = $2;
        `, [userId, courseId]);

        const currentAttempts = statusRes.rows.length > 0 ? statusRes.rows[0].attempts_taken : 0;

        if (currentAttempts >= maxAttempts) {
            return NextResponse.json({ success: false, message: 'Maximum attempts reached' }, { status: 403 });
        }

        // Upsert the entry and increment attempts. 
        // If it's the first time, insert with attempts_taken = 1
        await pool.query(`
            INSERT INTO user_assessments (user_id, course_id, status, attempts_taken, start_time)
            VALUES ($1, $2, 'started', 1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, course_id) 
            DO UPDATE SET 
                status = 'started', 
                attempts_taken = user_assessments.attempts_taken + 1,
                start_time = CURRENT_TIMESTAMP;
        `, [userId, courseId]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Assessment start error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
