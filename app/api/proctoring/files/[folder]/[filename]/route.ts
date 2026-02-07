import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ folder: string, filename: string }> }
) {
    try {
        const { folder, filename } = await params;
        const filePath = path.join(process.cwd(), 'record', folder, 'video', filename);

        if (!fs.existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.get('range');

        if (range) {
            // Handle Range requests for video seeking
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const stream = fs.createReadStream(filePath, { start, end });
            const chunks: Buffer[] = [];

            for await (const chunk of stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            const buffer = Buffer.concat(chunks);

            return new NextResponse(buffer, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': String(chunkSize),
                    'Content-Type': 'video/webm',
                    'Cache-Control': 'public, max-age=3600',
                }
            });
        }

        // Full file response
        const fileBuffer = fs.readFileSync(filePath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'video/webm',
                'Content-Length': String(fileSize),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=3600',
            }
        });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
