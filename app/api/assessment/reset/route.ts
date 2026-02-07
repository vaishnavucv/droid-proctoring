import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, courseId } = await request.json();

        if (!userId || !courseId) {
            return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        }

        // Reset the assessment record for this user and course
        await pool.query(`
            UPDATE user_assessments 
            SET status = 'not_started', 
                attempts_taken = 0, 
                score = NULL, 
                result = NULL, 
                start_time = NULL, 
                proctoring_logs = '[]'::jsonb
            WHERE user_id = $1 AND course_id = $2;
        `, [userId, courseId]);

        return NextResponse.json({ success: true, message: 'Assessment reset successfully' });
    } catch (error) {
        console.error('Assessment reset error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
