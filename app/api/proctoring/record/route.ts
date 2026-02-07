import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const chunk = formData.get('chunk') as Blob;
        const folderName = formData.get('folder') as string;
        const userId = formData.get('userId') as string;
        const type = formData.get('type') as string; // 'screen' or 'camera'
        const sessionTimestamp = formData.get('sessionTimestamp') as string; // stable per-session timestamp

        if (!chunk || !folderName) {
            console.error('[RECORD API] Missing chunk or folderName');
            return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
        }

        const buffer = Buffer.from(await chunk.arrayBuffer());

        const recordDir = path.join(process.cwd(), 'record', folderName, 'video');
        if (!fs.existsSync(recordDir)) {
            fs.mkdirSync(recordDir, { recursive: true });
        }

        // Use a STABLE filename per stream type per session
        // This ensures all chunks append to a single continuous file
        const fileName = `${sessionTimestamp}_${type}.webm`;
        const filePath = path.join(recordDir, fileName);

        // Append chunk data to the file (creates if doesn't exist)
        fs.appendFileSync(filePath, buffer);

        const stats = fs.statSync(filePath);
        console.log(`[RECORD] Appended ${type} chunk (${buffer.length} bytes) → ${fileName} (total: ${stats.size} bytes)`);

        return NextResponse.json({ success: true, path: filePath, totalSize: stats.size });
    } catch (error: any) {
        console.error('Recording storage error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
