import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ folder: string }> }
) {
    try {
        const { folder } = await params;
        const videoDir = path.join(process.cwd(), 'record', folder, 'video');

        if (!fs.existsSync(videoDir)) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        const files = fs.readdirSync(videoDir)
            .filter(f => f.endsWith('.webm'))
            .map(f => {
                const stat = fs.statSync(path.join(videoDir, f));
                // Filename format: userId_courseId_sessionStartISO_type.webm
                // e.g. 999999_222222_2026-02-07T05-57-15-992Z_screen.webm
                const baseName = f.replace('.webm', '');
                const type = baseName.endsWith('_screen') ? 'screen' : baseName.endsWith('_camera') ? 'camera' : 'unknown';

                // Extract timestamp from the filename
                // Remove the _type suffix to get the rest
                const withoutType = baseName.replace(/_screen$/, '').replace(/_camera$/, '');
                // The timestamp part is after userId_courseId_
                const parts = withoutType.split('_');
                // parts[0] = userId, parts[1] = courseId, rest = timestamp parts
                const timestampPart = parts.slice(2).join('_');

                return {
                    name: f,
                    url: `/api/proctoring/files/${folder}/${f}`,
                    type: type as 'screen' | 'camera',
                    timestamp: timestampPart || baseName,
                    size: stat.size,
                    created: stat.birthtime.toISOString(),
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ success: true, chunks: files });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
