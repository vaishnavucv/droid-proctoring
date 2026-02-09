import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ folder: string }> }
) {
    try {
        const { folder } = await params;
        const logsDir = path.join(process.cwd(), 'logs');

        if (!fs.existsSync(logsDir)) {
            return NextResponse.json({ success: true, logs: [], message: 'No logs directory' });
        }

        // Session folder format: {username}_{userId}_{date}_{time}
        // Log file format: {username}_{userId}_{date}_{time}.json
        // Match by finding log files that share the same prefix as the session folder
        const allLogFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.json'));

        // Try exact match first (folder name matches log file name without .json)
        let matchedFile = allLogFiles.find(f => f === `${folder}.json`);

        // If no exact match, try partial match based on username_userId prefix
        if (!matchedFile) {
            // Extract username and userId from folder: "username_userId_date_time"
            const parts = folder.split('_');
            if (parts.length >= 2) {
                const prefix = `${parts[0]}_${parts[1]}`;
                // Find log files with the same username_userId prefix, sorted by most recent
                const candidates = allLogFiles
                    .filter(f => f.startsWith(prefix))
                    .sort((a, b) => b.localeCompare(a)); // most recent first

                // Try to match by date too
                if (parts.length >= 3) {
                    const datePrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
                    const dateMatch = candidates.find(f => f.startsWith(datePrefix));
                    if (dateMatch) {
                        matchedFile = dateMatch;
                    }
                }

                // Fallback to most recent log for this user
                if (!matchedFile && candidates.length > 0) {
                    matchedFile = candidates[0];
                }
            }
        }

        if (!matchedFile) {
            return NextResponse.json({ success: true, logs: [], message: 'No matching log file found' });
        }

        const filePath = path.join(logsDir, matchedFile);
        const content = fs.readFileSync(filePath, 'utf8');
        let logs = [];
        try {
            logs = JSON.parse(content);
        } catch {
            logs = [];
        }

        return NextResponse.json({
            success: true,
            logs,
            logFile: matchedFile
        });

    } catch (error: any) {
        console.error('Logs fetch error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
