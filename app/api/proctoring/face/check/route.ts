import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'MISSING_KEY',
});

export async function POST(req: NextRequest) {
    try {
        const { image, folder, userId, username, timestamp } = await req.json();

        if (!image || !folder) {
            return NextResponse.json({ success: false, error: 'Missing image or folder' }, { status: 400 });
        }

        // Load the reference face
        const facePath = path.join(process.cwd(), 'record', folder, 'face', `reference_${userId}.jpg`);

        if (!fs.existsSync(facePath)) {
            return NextResponse.json({ success: true, alert: false, reason: 'No reference face registered yet' });
        }

        const referenceBuffer = fs.readFileSync(facePath);
        const referenceBase64 = referenceBuffer.toString('base64');

        // Current image
        const currentBase64 = image.split(',')[1];

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `You are a STRICT proctoring security system for an online exam. Compare these two images:

Image 1 = REGISTERED reference face of the authorized candidate.
Image 2 = CURRENT live camera frame.

Analyze the current frame for ALL of these violations:

1. **faceDetected** — Is there at least one face visible?
2. **samePerson** — Is the primary face the SAME person as the reference? Be strict.
3. **multipleFaces** — Are there 2 or MORE faces visible? Even partially visible faces, reflections of another person, or someone sitting nearby count.
4. **talkingToSomeone** — Does it appear the candidate is talking, whispering, or communicating with another person nearby? Look for: mouth open in speech, head turned toward someone, visible nearby person they could be talking to, lips moving.
5. **lookingAway** — Is the candidate looking significantly away from the screen (sideways, behind, down at phone/notes)?
6. **suspiciousActivity** — Any other suspicious behavior: using earpiece, holding phone, reading notes, someone handing them something.

IMPORTANT RULES:
- If you see ANY second person (even partially, in background, reflection, or edge of frame), multipleFaces = true
- If the candidate appears to be speaking/whispering while another person is nearby, talkingToSomeone = true
- Be very strict about all violations. This is a high-security exam.

Return JSON only: { "faceDetected": boolean, "samePerson": boolean, "multipleFaces": boolean, "talkingToSomeone": boolean, "lookingAway": boolean, "suspiciousActivity": boolean, "confidence": number (0-100), "reason": "brief explanation of what you see" }`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${referenceBase64}`,
                                detail: "low"
                            }
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${currentBase64}`,
                                detail: "low"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');

        // Determine alert severity
        let alert = false;
        let alertReason = '';
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

        if (!result.faceDetected) {
            alert = true;
            alertReason = '⚠️ NO FACE DETECTED — Camera may be blocked or candidate absent';
            severity = 'high';
        } else if (!result.samePerson) {
            alert = true;
            alertReason = `🚨 DIFFERENT PERSON DETECTED — Unauthorized individual at terminal (confidence: ${result.confidence}%)`;
            severity = 'critical';
        } else if (result.multipleFaces && result.talkingToSomeone) {
            alert = true;
            alertReason = `🚨 CANDIDATE COMMUNICATING WITH NEARBY PERSON — Multiple faces detected and candidate appears to be talking`;
            severity = 'critical';
        } else if (result.multipleFaces) {
            alert = true;
            alertReason = `⚠️ MULTIPLE FACES DETECTED — ${result.reason || 'Unauthorized person visible in frame'}`;
            severity = 'high';
        } else if (result.talkingToSomeone) {
            alert = true;
            alertReason = `⚠️ CANDIDATE APPEARS TO BE TALKING TO SOMEONE — Possible verbal communication with nearby person`;
            severity = 'high';
        } else if (result.suspiciousActivity) {
            alert = true;
            alertReason = `⚠️ SUSPICIOUS ACTIVITY — ${result.reason || 'Unauthorized behavior detected'}`;
            severity = 'medium';
        } else if (result.lookingAway) {
            alert = true;
            alertReason = `⚠️ CANDIDATE LOOKING AWAY — Possible reference to external materials`;
            severity = 'medium';
        }

        if (alert) {
            console.warn(`[FACE CHECK ${severity.toUpperCase()}] User ${username} (${userId}) at ${timestamp}: ${alertReason}`);
        }

        return NextResponse.json({
            success: true,
            alert,
            reason: alertReason || result.reason,
            severity,
            behavior: {
                faceDetected: result.faceDetected,
                samePerson: result.samePerson,
                multipleFaces: result.multipleFaces,
                talkingToSomeone: result.talkingToSomeone,
                lookingAway: result.lookingAway,
                suspiciousActivity: result.suspiciousActivity,
                confidence: result.confidence
            }
        });

    } catch (error: any) {
        console.error('Face check error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
