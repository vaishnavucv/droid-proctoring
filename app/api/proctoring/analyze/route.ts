import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'MISSING_KEY',
});

export async function POST(req: NextRequest) {
    try {
        const { image, userId, username, timestamp, source } = await req.json();

        if (!image) {
            return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
        }

        // Extract base64 content
        const base64Image = image.split(',')[1];

        let prompt = "";
        if (source === 'camera') {
            prompt = `You are a STRICT proctoring security AI for a high-security online exam. Analyze this camera frame.

DETECT ALL of the following violations:
1. **No Face** — Alert if NO face is visible (camera blocked, empty seat, face out of frame).
2. **Blue/Fake Face** — Alert if face appears unnaturally blue, distorted, heavily filtered, or is a photo/screen of a face.
3. **Multiple Faces** — CRITICAL: Alert if 2+ faces are visible. This includes: partial faces at frame edges, someone sitting nearby, reflections showing another person, anyone in the background. Be very strict.
4. **Talking to Someone** — CRITICAL: Alert if candidate appears to be speaking, whispering, or communicating with another person. Signs: mouth open in speech while head turned, visible nearby person, lips moving, gesturing toward someone.
5. **Looking Away** — Alert if candidate is looking significantly away from screen (sideways, behind them, down at phone/notes).
6. **Eye Scanning** — Alert if eyes are moving significantly sideways (reading off-screen notes or another display).

IMPORTANT: Be VERY strict about multiple faces and talking. Even a partial face or someone barely visible in the background should trigger multipleFaces. If the candidate's mouth is open and head is turned sideways, flag talkingToSomeone.

Return JSON: { "alert": boolean, "reason": "string", "behavior": { "faceDetected": boolean, "blueFaceDetected": boolean, "multipleFaces": boolean, "talkingToSomeone": boolean, "lookingAway": boolean, "eyeSideways": boolean } }`;
        } else if (source === 'screen') {
            prompt = `Analyze this proctoring screen capture for assessment security. 
            Requirements:
            1. External IDE: Trigger alert if any external IDE (VS Code, IntelliJ, etc.) is visible.
            2. ChatGPT/AI Tools: Trigger alert if ChatGPT, Claude, Gemini, or any AI tool website is visible.
            3. Browser Search: Trigger alert if unauthorized browser search tabs or search results (Google, Bing) are visible outside the allowed lab context.
            4. Unauthorized Apps: Trigger alert if any other unauthorized application popups or windows are open (Discord, Slack, Spotify, etc.).
            5. Note: Common OS system popups (Volume, Brightness, OS Notifications) are ALLOWED and should NOT trigger an alert.
            
            Return JSON: { "alert": boolean, "reason": "string", "behavior": { "ideDetected": boolean, "aiToolDetected": boolean, "searchDetected": boolean, "unauthorizedApp": boolean } }`;
        }

        // Call OpenAI Vision to detect suspicious behavior
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:image/jpeg;base64,${base64Image}`,
                                "detail": "low"
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');

        // If alert is true, we might want to log this specifically as an AI alerted malpractice
        if (result.alert) {
            console.warn(`[AI ALERT] User ${username} (${userId}) at ${timestamp}: ${result.reason}`);
        }

        return NextResponse.json({
            success: true,
            alert: result.alert,
            reason: result.reason
        });

    } catch (error: any) {
        console.error('AI Analysis error:', error);
        // Fallback to avoid breaking the front-end flow
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
