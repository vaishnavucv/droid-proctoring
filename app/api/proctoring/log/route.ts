import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, userId, sessionStartTime, warningCount, type, duration, timestamp, justification } = body;

        // Create log entry
        const logEntry = {
            warningCount,
            type, // 'fullscreen' or 'visibility'
            duration, // duration from lab start in HH:mm:ss OR seconds
            timestamp,
            justification: justification || "N/A"
        };

        // Define logs directory
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Generate filename: username_userid_sessionStartTime.json
        const sessionDate = new Date(sessionStartTime || Date.now());
        const timestampStr = sessionDate.toISOString().split('T')[0] + '_' + sessionDate.toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `${username}_${userId}_${timestampStr}.json`;
        const filePath = path.join(logsDir, fileName);

        let logs = [];
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            try {
                logs = JSON.parse(fileContent);
            } catch (e) {
                logs = [];
            }
        }

        logs.push(logEntry);

        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));

        return NextResponse.json({ success: true, message: 'Proctoring logged successfully' });
    } catch (error: any) {
        console.error('Proctoring log error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
