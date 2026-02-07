import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { userId, courseId, proctoringLogs, isProctoringFailure } = await req.json();

        if (!userId || !courseId) {
            return NextResponse.json({ success: false, message: 'Missing userId or courseId' }, { status: 400 });
        }

        // If it's a proctoring failure, score is 0 and result is Fail
        const score = isProctoringFailure ? 0 : 85;
        const result = isProctoringFailure ? 'Fail' : (score >= 70 ? 'Pass' : 'Fail');
        const proctoringJSON = JSON.stringify(proctoringLogs || []);

        // Update the assessment status to completed with score, result, and proctoring logs
        await pool.query(`
            UPDATE user_assessments 
            SET status = 'completed', 
                score = $3, 
                result = $4, 
                proctoring_logs = $5,
                end_time = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND course_id = $2;
        `, [userId, courseId, score, result, proctoringJSON]);

        return NextResponse.json({ success: true, score, result });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
