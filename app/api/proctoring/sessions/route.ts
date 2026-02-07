import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const recordDir = path.join(process.cwd(), 'record');
        if (!fs.existsSync(recordDir)) {
            return NextResponse.json({ success: true, sessions: [] });
        }

        const sessions = fs.readdirSync(recordDir)
            .filter(f => fs.statSync(path.join(recordDir, f)).isDirectory())
            .map(folder => {
                const logsPath = path.join(process.cwd(), 'logs');
                // Try to find a log file that matches this session if possible
                // For now just return the folder name
                return {
                    id: folder,
                    name: folder,
                    timestamp: folder.split('_').pop()?.replace(/-/g, ':') || 'Unknown'
                };
            })
            .sort((a, b) => b.id.localeCompare(a.id));

        return NextResponse.json({ success: true, sessions });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
