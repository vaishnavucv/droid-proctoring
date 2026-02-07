import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { image, folder, userId } = await req.json();

        if (!image || !folder) {
            return NextResponse.json({ success: false, error: 'Missing image or folder' }, { status: 400 });
        }

        // Extract base64 data
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Save reference face to session folder
        const faceDir = path.join(process.cwd(), 'record', folder, 'face');
        if (!fs.existsSync(faceDir)) {
            fs.mkdirSync(faceDir, { recursive: true });
        }

        const facePath = path.join(faceDir, `reference_${userId}.jpg`);
        fs.writeFileSync(facePath, buffer);

        console.log(`[FACE REGISTER] Saved reference face for user ${userId} in ${folder} (${buffer.length} bytes)`);

        return NextResponse.json({ success: true, message: 'Reference face registered' });
    } catch (error: any) {
        console.error('Face registration error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
