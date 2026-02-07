import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const courseId = searchParams.get('courseId');

    if (!userId || !courseId) {
        return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
    }

    try {
        const res = await pool.query(`
            SELECT status, attempts_taken, score, result 
            FROM user_assessments 
            WHERE user_id = $1 AND course_id = $2;
        `, [userId, courseId]);

        if (res.rows.length === 0) {
            return NextResponse.json({
                success: true,
                status: 'not_started',
                attempts_taken: 0,
                score: null,
                result: null
            });
        }

        return NextResponse.json({
            success: true,
            status: res.rows[0].status,
            attempts_taken: res.rows[0].attempts_taken,
            score: res.rows[0].score,
            result: res.rows[0].result
        });
    } catch (error) {
        console.error('Status fetch error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
