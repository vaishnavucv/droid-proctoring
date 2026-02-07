"use client"

import { useState, useEffect, use, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Clock, CheckCircle2, AlertCircle, Monitor, Loader2, Play,
    RefreshCcw, Camera, Mic, Clipboard, Maximize, ShieldCheck,
    Check, ShieldAlert, XCircle, MailPlus, RotateCcw, ArrowLeft,
    AlertTriangle, Timer, Wifi, WifiOff, Video, ScanFace
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"

interface CourseConfig {
    startDate: string;
    endDate: string;
    allowedTimeMinutes: number;
    labUrl: string;
}

const idToDetails: Record<string, { title: string, level: string, slug: string }> = {
    "111111": { title: "Ubuntu Linux Administrator", level: "Expert Assessment", slug: "ubuntu-linux" },
    "222222": { title: "Cybersecurity 101", level: "Beginner Assessment", slug: "cybersecurity-101" },
    "333333": { title: "Python 101", level: "Beginner Assessment", slug: "python-101" },
    "444444": { title: "DevSecOps Engineer", level: "Specialist Assessment", slug: "devsecops" },
}

const FACE_REGISTRATION_PERIOD_MS = 20 * 1000 // 20 seconds — fast registration (4 cycles at 5s intervals)
const RECORDING_CHUNK_INTERVAL_MS = 5000 // 5 seconds
const AI_ANALYSIS_INTERVAL_MS = 5000 // 5 seconds — fast detection

export default function AssessmentPage({ params }: { params: Promise<{ courseId: string, userId: string }> }) {
    const { courseId, userId } = use(params)
    const [config, setConfig] = useState<CourseConfig | null>(null)
    const [redirectDelay, setRedirectDelay] = useState(5)
    const [timeLeft, setTimeLeft] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [isComplete, setIsComplete] = useState(false)
    const [countdown, setCountdown] = useState(0)

    // Lab States
    const [labStatus, setLabStatus] = useState<'idle' | 'starting' | 'running'>('idle')
    const [labProgress, setLabProgress] = useState(0)
    const [iframeKey, setIframeKey] = useState(0)

    // Permission States
    const [permissions, setPermissions] = useState({
        screen: false,
        camera: false,
        mic: false,
        clipboard: false,
        fullscreen: false
    })
    const [isVetting, setIsVetting] = useState(false)
    const [screenError, setScreenError] = useState(false)
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null)
    const [warningCount, setWarningCount] = useState(0)
    const [isFailed, setIsFailed] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [alertReason, setAlertReason] = useState<string | null>(null)
    const [showWarning, setShowWarning] = useState(false)
    const [justification, setJustification] = useState("")
    const [justifications, setJustifications] = useState<{ count: number, reason: string, timestamp: string }[]>([])

    // Face detection phase
    const [facePhase, setFacePhase] = useState<'registering' | 'monitoring' | 'idle'>('idle')
    const [faceRegistered, setFaceRegistered] = useState(false)
    const faceRegisterCount = useRef(0)

    // Refs for recorders and intervals
    const [wasSubmitted, setWasSubmitted] = useState(false)
    const [labStartTime, setLabStartTime] = useState<number | null>(null)
    const [username, setUsername] = useState("anonymous")
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
    const [recordingSessionFolder, setRecordingSessionFolder] = useState("")
    const [sessionTimestamp, setSessionTimestamp] = useState("") // stable timestamp for recording files

    // Refs for recorders and intervals
    const screenRecorderRef = useRef<MediaRecorder | null>(null)
    const cameraRecorderRef = useRef<MediaRecorder | null>(null)
    const aiIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const facePhaseTimerRef = useRef<NodeJS.Timeout | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    const router = useRouter()
    const course = idToDetails[courseId] || { title: "Unknown Course", level: "", slug: "" }

    useEffect(() => {
        async function loadConfig() {
            try {
                const response = await fetch('/course-config.json')
                const data = await response.json()

                if (data.settings && data.settings.redirectDelaySeconds) {
                    setRedirectDelay(data.settings.redirectDelaySeconds)
                }

                const courseSlug = course.slug
                if (data[courseSlug]) {
                    const cfg = data[courseSlug]
                    setConfig(cfg)
                    setTimeLeft(cfg.allowedTimeMinutes * 60)
                }
            } catch (err) {
                console.error("Failed to load config", err)
            } finally {
                setIsLoading(false)
            }
        }
        loadConfig()

        // Retrieve user info for logging
        const savedUser = localStorage.getItem("user")
        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser)
                if (parsed.username) setUsername(parsed.username)
            } catch (e) {
                console.error("Failed to parse user info", e)
            }
        }
    }, [course.slug])

    // Timer logic
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (!isComplete && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1)
            }, 1000)
        } else if (timeLeft === 0 && !isComplete && !isLoading) {
            handleComplete()
        }
        return () => clearInterval(timer)
    }, [isComplete, timeLeft, isLoading])

    // Lab starting logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (labStatus === 'starting') {
            interval = setInterval(() => {
                setLabProgress((prev) => {
                    const next = prev + 1;
                    if (next >= 100) {
                        setLabStatus('running');
                        const startTime = Date.now();
                        setLabStartTime(startTime);

                        // Generate a unique folder name for this session
                        const date = new Date(startTime);
                        const timestampStr = date.toISOString().split('T')[0] + '_' + date.toTimeString().split(' ')[0].replace(/:/g, '-');
                        const folderName = `${username}_${userId}_${timestampStr}`;
                        setRecordingSessionFolder(folderName);

                        // Generate STABLE session timestamp for recording filenames
                        const stableTs = `${userId}_${courseId}_${date.toISOString().replace(/[:.]/g, '-')}`;
                        setSessionTimestamp(stableTs);

                        // Start face registration phase
                        setFacePhase('registering');
                        faceRegisterCount.current = 0;

                        clearInterval(interval);
                        return 100;
                    }
                    return next;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [labStatus])

    useEffect(() => {
        if (isFailed && !wasSubmitted) {
            handleComplete()
        }
    }, [isFailed, wasSubmitted])

    // Face phase transition: after 2 minutes, switch from registering → monitoring
    useEffect(() => {
        if (facePhase === 'registering') {
            facePhaseTimerRef.current = setTimeout(() => {
                console.log('[FACE] Registration period ended. Switching to monitoring mode.');
                setFacePhase('monitoring');
                setFaceRegistered(true);
            }, FACE_REGISTRATION_PERIOD_MS);

            return () => {
                if (facePhaseTimerRef.current) clearTimeout(facePhaseTimerRef.current);
            };
        }
    }, [facePhase])

    const [warningType, setWarningType] = useState<string>('ai-alert')

    const triggerWarning = useCallback((type: 'fullscreen' | 'visibility' | 'ai-alert' | 'face-malpractice', reason?: string) => {
        if (labStatus === 'running' && !isFailed && !isComplete) {
            let currentWarningCount = 0;
            setWarningCount(prev => {
                const next = prev + 1
                currentWarningCount = next;

                // DevSecOps track (444444) is exempt from the 5-warning lockout rule.
                // It allows the user to complete the assessment within the duration.
                if (next >= 5 && courseId !== "444444") {
                    setIsFailed(true)
                } else {
                    setShowWarning(true)
                    setAlertReason(reason || null)
                    setWarningType(type)
                    // Show warning for 15 seconds for face malpractice, 10s for others
                    const duration = type === 'face-malpractice' ? 15000 : 10000;
                    setTimeout(() => setShowWarning(false), duration)
                }
                return next
            })

            // Log malpractice
            const logMalpractice = async () => {
                const now = Date.now();
                const diff = labStartTime ? Math.floor((now - labStartTime) / 1000) : 0;
                const hh = Math.floor(diff / 3600).toString().padStart(2, '0');
                const mm = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
                const ss = (diff % 60).toString().padStart(2, '0');
                const durationStr = `${hh}:${mm}:${ss}`;

                try {
                    await fetch('/api/proctoring/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username,
                            userId,
                            sessionStartTime: labStartTime,
                            warningCount: currentWarningCount,
                            type: reason ? `${type}: ${reason}` : type,
                            duration: durationStr,
                            timestamp: new Date().toLocaleTimeString(),
                        })
                    });
                } catch (err) {
                    console.error("Failed to log proctoring malpractice", err);
                }
            };
            logMalpractice();
        }
    }, [labStatus, isFailed, isComplete, labStartTime, username, userId]);

    useEffect(() => {
        const handleFS = () => {
            const isFS = !!document.fullscreenElement
            setPermissions(prev => ({ ...prev, fullscreen: isFS }))
            if (!isFS) triggerWarning('fullscreen')
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                setPermissions(prev => ({ ...prev, fullscreen: false }))
                triggerWarning('visibility')
            }
        }

        document.addEventListener('fullscreenchange', handleFS)
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            document.removeEventListener('fullscreenchange', handleFS)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [labStatus, isFailed, isComplete, triggerWarning])

    // ── Recording & AI Analysis Logic ──
    useEffect(() => {
        if (labStatus === 'running' && recordingSessionFolder && sessionTimestamp && !isFailed && !isComplete) {

            const startRecording = (stream: MediaStream, type: 'screen' | 'camera') => {
                try {
                    if (!stream.active) return null;

                    const types = [
                        'video/webm;codecs=vp9,opus',
                        'video/webm;codecs=vp8,opus',
                        'video/webm',
                        'video/mp4;codecs=avc1',
                        'video/mp4',
                        ''
                    ];

                    const supportedType = types.find(t => !t || MediaRecorder.isTypeSupported(t)) || '';
                    const options = supportedType ? { mimeType: supportedType } : {};

                    if (stream.getVideoTracks().length === 0) {
                        console.error(`No video tracks found for ${type} recording`);
                        return null;
                    }

                    console.log(`[REC] Starting ${type} recording with mimeType: ${supportedType || 'default'}`);
                    const recorder = new MediaRecorder(stream, options);

                    recorder.ondataavailable = async (e) => {
                        if (e.data.size > 0) {
                            setIsRecording(true);

                            const formData = new FormData();
                            formData.append('chunk', e.data);
                            formData.append('folder', recordingSessionFolder);
                            formData.append('userId', userId);
                            formData.append('type', type);
                            // Use STABLE session timestamp — all chunks go to same file
                            formData.append('sessionTimestamp', sessionTimestamp);

                            try {
                                await fetch('/api/proctoring/record', {
                                    method: 'POST',
                                    body: formData
                                });
                            } catch (err) {
                                console.error(`Network error uploading ${type} chunk`, err);
                            }
                        }
                    };

                    recorder.start(RECORDING_CHUNK_INTERVAL_MS);
                    return recorder;
                } catch (err) {
                    console.error(`Failed to start ${type} recording`, err);
                    return null;
                }
            };

            // Start recordings
            if (activeStream) screenRecorderRef.current = startRecording(activeStream, 'screen');
            if (cameraStream) cameraRecorderRef.current = startRecording(cameraStream, 'camera');

            // ── AI Analysis + Face Detection ──
            const extractAndAnalyze = async () => {
                if (!canvasRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const now = Date.now();
                const elapsed = labStartTime ? now - labStartTime : 0;
                const isRegistrationPhase = elapsed < FACE_REGISTRATION_PERIOD_MS;

                // Prioritize camera analysis (70% camera / 30% screen) for fast face detection
                const useSource = now % 10000 < 7000 ? 'camera' : 'screen';
                const stream = useSource === 'camera' ? cameraStream : activeStream;

                if (stream && stream.active) {
                    const video = document.createElement('video');
                    video.muted = true;
                    video.playsInline = true;
                    video.srcObject = stream;
                    try {
                        await video.play();
                        canvas.width = video.videoWidth || 640;
                        canvas.height = video.videoHeight || 480;
                        ctx.drawImage(video, 0, 0);
                        const base64Image = canvas.toDataURL('image/jpeg', 0.6);
                        video.pause();
                        video.srcObject = null;

                        if (useSource === 'camera') {
                            if (isRegistrationPhase) {
                                // ── FACE REGISTRATION PHASE (20s window) ──
                                // Save reference face on every camera cycle for best quality
                                faceRegisterCount.current += 1;
                                // Register on every cycle during the short 20s window
                                if (faceRegisterCount.current >= 1) {
                                    try {
                                        console.log(`[FACE] Registering reference face (cycle ${faceRegisterCount.current})...`);
                                        await fetch('/api/proctoring/face/register', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                image: base64Image,
                                                folder: recordingSessionFolder,
                                                userId,
                                            })
                                        });
                                    } catch (err) {
                                        console.error('[FACE] Failed to register face', err);
                                    }
                                }

                                // Also run basic analysis during registration (no-face, multiple faces)
                                try {
                                    const res = await fetch('/api/proctoring/analyze', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            image: base64Image,
                                            userId,
                                            username,
                                            timestamp: new Date().toLocaleTimeString(),
                                            source: 'camera'
                                        })
                                    });
                                    const data = await res.json();
                                    if (data.alert && data.behavior) {
                                        // During registration: alert on no-face, multiple faces, or talking
                                        if (!data.behavior.faceDetected || data.behavior.multipleFaces || data.behavior.talkingToSomeone) {
                                            const wType = data.behavior.multipleFaces || data.behavior.talkingToSomeone
                                                ? 'face-malpractice' : 'ai-alert';
                                            triggerWarning(wType, data.reason);
                                        }
                                    }
                                } catch (err) {
                                    console.error('[AI] Registration phase analysis failed', err);
                                }
                            } else {
                                // ── FACE MONITORING PHASE ──
                                // Compare current face against registered reference
                                try {
                                    const res = await fetch('/api/proctoring/face/check', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            image: base64Image,
                                            folder: recordingSessionFolder,
                                            userId,
                                            username,
                                            timestamp: new Date().toLocaleTimeString(),
                                        })
                                    });
                                    const data = await res.json();
                                    if (data.alert) {
                                        // Classify severity for face malpractice
                                        const isCritical = data.behavior && (
                                            !data.behavior.samePerson ||
                                            data.behavior.multipleFaces ||
                                            data.behavior.talkingToSomeone
                                        );
                                        triggerWarning(
                                            isCritical ? 'face-malpractice' : 'ai-alert',
                                            data.reason
                                        );
                                    }
                                } catch (err) {
                                    console.error('[FACE] Monitoring check failed', err);
                                }
                            }
                        } else if (useSource === 'screen') {
                            // Screen analysis (same as before)
                            try {
                                const res = await fetch('/api/proctoring/analyze', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        image: base64Image,
                                        userId,
                                        username,
                                        timestamp: new Date().toLocaleTimeString(),
                                        source: 'screen'
                                    })
                                });
                                const data = await res.json();
                                if (data.alert) {
                                    triggerWarning('ai-alert', data.reason);
                                }
                            } catch (err) {
                                console.error('[AI] Screen analysis failed', err);
                            }
                        }
                    } catch (err) {
                        console.error("AI Analysis cycle failed", err);
                    }
                }
            };

            aiIntervalRef.current = setInterval(extractAndAnalyze, AI_ANALYSIS_INTERVAL_MS);

            return () => {
                console.log("[REC] Stopping proctoring session...");
                if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') screenRecorderRef.current.stop();
                if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') cameraRecorderRef.current.stop();
                if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);

                if (labStatus !== 'running' || isFailed || isComplete) {
                    if (activeStream) activeStream.getTracks().forEach(t => t.stop());
                    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
                }
            };
        }
    }, [labStatus, recordingSessionFolder, sessionTimestamp, activeStream, cameraStream, isFailed, isComplete, triggerWarning])

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isComplete && countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1)
            }, 1000)
        } else if (isComplete && countdown === 0) {
            router.push(`/dashboard/course/${course.slug}`)
        }
        return () => clearInterval(timer)
    }, [isComplete, countdown, course.slug, router])

    const handleComplete = async () => {
        if (wasSubmitted) return
        setWasSubmitted(true)

        // Stop recorders gracefully before submitting
        if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
            screenRecorderRef.current.stop();
        }
        if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') {
            cameraRecorderRef.current.stop();
        }
        if (aiIntervalRef.current) {
            clearInterval(aiIntervalRef.current);
        }

        try {
            await fetch('/api/assessment/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    courseId,
                    proctoringLogs: justifications,
                    isProctoringFailure: isFailed
                }),
            })
        } catch (err) {
            console.error("Failed to record completion", err)
        }

        if (!isFailed) {
            setIsComplete(true)
            setCountdown(redirectDelay)
        }
    }

    const handleRetake = useCallback(() => {
        // Stop any active recorders/intervals
        if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') screenRecorderRef.current.stop();
        if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') cameraRecorderRef.current.stop();
        if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
        if (facePhaseTimerRef.current) clearTimeout(facePhaseTimerRef.current);

        // Stop media tracks
        if (activeStream) activeStream.getTracks().forEach(track => track.stop());
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());

        // Reset all states
        setWarningCount(0);
        setLabStatus('idle');
        setIsFailed(false);
        setIsComplete(false);
        setWasSubmitted(false);
        setJustification("");
        setJustifications([]);
        setLabProgress(0);
        setFacePhase('idle');
        setFaceRegistered(false);
        setIsRecording(false);
        setRecordingSessionFolder("");
        setSessionTimestamp("");
        setShowWarning(false);
        setAlertReason(null);
        setActiveStream(null);
        setCameraStream(null);

        faceRegisterCount.current = 0;

        // Reset timer if config exists
        if (config) {
            setTimeLeft(config.allowedTimeMinutes * 60);
        }

        setPermissions({
            screen: false,
            camera: false,
            mic: false,
            clipboard: false,
            fullscreen: false
        });
        setIsVetting(false);
    }, [activeStream, cameraStream, config]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`
    }

    const handleRefreshLab = () => {
        setIframeKey(prev => prev + 1)
    }

    // Permission Handlers
    const requestMedia = async () => {
        setIsVetting(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            setPermissions(prev => ({ ...prev, camera: true, mic: true }))
            setCameraStream(stream)
            // DON'T stop tracks — needed for recording
        } catch (err) {
            console.error("Media permission denied", err)
        } finally {
            setIsVetting(false)
        }
    }

    const requestScreen = async () => {
        setIsVetting(true)
        setScreenError(false)
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'monitor'
                } as any
            })

            const track = stream.getVideoTracks()[0]
            const settings = track.getSettings()

            if (settings.displaySurface === 'monitor') {
                setPermissions(prev => ({ ...prev, screen: true }))
                setScreenError(false)
                setActiveStream(stream)

                track.onended = () => {
                    setPermissions(prev => ({ ...prev, screen: false }))
                    setScreenError(true)
                }
            } else {
                setScreenError(true)
                setPermissions(prev => ({ ...prev, screen: false }))
                stream.getTracks().forEach(track => track.stop())
            }
        } catch (err) {
            console.error("Screen permission denied", err)
            setScreenError(false)
        } finally {
            setIsVetting(false)
        }
    }

    const requestClipboard = async () => {
        try {
            await navigator.clipboard.writeText("check")
            setPermissions(prev => ({ ...prev, clipboard: true }))
        } catch (err) {
            console.error("Clipboard permission denied", err)
        }
    }

    const requestFullscreen = async () => {
        if (!justification.trim() && !permissions.fullscreen && labStatus === 'running') {
            alert("Please provide a justification for the security violation first.")
            return
        }

        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen()
                setPermissions(prev => ({ ...prev, fullscreen: true }))

                if (justification.trim()) {
                    setJustifications(prev => [...prev, {
                        count: warningCount,
                        reason: justification,
                        timestamp: new Date().toISOString()
                    }])
                    setJustification("")
                }
            } else {
                setPermissions(prev => ({ ...prev, fullscreen: true }))
            }
        } catch (err) {
            console.error("Fullscreen failed", err)
        }
    }

    const allPermissionsGranted = Object.values(permissions).every(p => p)

    const timeWarning = timeLeft < 300 && timeLeft > 0

    // ── Loading State ──
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
                <div className="relative">
                    <Skeleton className="w-16 h-16 rounded-2xl" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                </div>
                <div className="space-y-2 text-center">
                    <h2 className="text-lg font-bold tracking-tight">Initializing Secure Environment</h2>
                    <p className="text-sm text-muted-foreground">Verifying session credentials...</p>
                </div>
                <div className="flex gap-1.5">
                    <Skeleton className="w-2 h-2 rounded-full animate-pulse" />
                    <Skeleton className="w-2 h-2 rounded-full animate-pulse delay-100" />
                    <Skeleton className="w-2 h-2 rounded-full animate-pulse delay-200" />
                </div>
            </div>
        )
    }

    // ── Assessment Failed State ──
    if (isFailed) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                <Card className="max-w-lg w-full border-rose-900/50 bg-zinc-900/80 backdrop-blur-xl shadow-2xl shadow-rose-950/20 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600" />
                    <CardHeader className="text-center pt-12 pb-6 space-y-6">
                        <div className="relative mx-auto">
                            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center ring-2 ring-rose-500/20">
                                <XCircle className="w-10 h-10 text-rose-500" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center ring-4 ring-zinc-900">
                                <AlertTriangle className="w-3 h-3 text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-black uppercase text-rose-400 tracking-tight">
                                Assessment Failed
                            </CardTitle>
                            <CardDescription className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                                Your session has been terminated due to repeated proctoring violations.
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="px-8 pb-8 space-y-4">
                        <Alert variant="destructive" className="bg-rose-950/30 border-rose-800/40">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                                Access Permanently Revoked
                            </AlertTitle>
                            <AlertDescription className="text-xs text-rose-300/70">
                                Your session has been flagged for security review.
                            </AlertDescription>
                        </Alert>

                        <Separator className="bg-zinc-800" />

                        <div className="space-y-3 pt-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const logString = justifications.map(j => `Warning ${j.count}: ${j.reason}`).join('%0A');
                                                window.location.href = `mailto:support@nuvepro.com?subject=Lab Failure Ticket - ${userId}&body=Justifications:%0A${logString}`
                                            }}
                                            className="w-full h-12 border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs gap-2 rounded-xl transition-all"
                                        >
                                            <MailPlus className="w-4 h-4" />
                                            Raise Support Ticket
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Opens your email client to contact support</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button
                                onClick={handleRetake}
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 rounded-xl shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Retake Assessment
                            </Button>

                            <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-lg p-3">
                                <p className="text-[10px] font-medium text-zinc-500 text-center leading-relaxed">
                                    Note: Retake is available for testing purposes only.
                                </p>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="justify-center pb-8">
                        <Button
                            variant="ghost"
                            onClick={() => router.push(`/dashboard/course/${course.slug}`)}
                            className="text-zinc-500 hover:text-zinc-300 font-medium text-xs gap-2"
                        >
                            <ArrowLeft className="w-3 h-3" />
                            Return to Dashboard
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // ── Assessment Complete State ──
    if (isComplete) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <Card className="max-w-md w-full border-emerald-200 dark:border-emerald-900/50 bg-card shadow-xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
                    <CardHeader className="pt-12 pb-4 space-y-4">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto ring-2 ring-emerald-500/20 animate-bounce">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-black tracking-tight uppercase">
                                Assessment Submitted
                            </CardTitle>
                            <CardDescription className="max-w-sm mx-auto leading-relaxed">
                                Your lab activities and assessment data for <strong className="text-foreground">{course.title}</strong> have been securely recorded.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="pb-6 space-y-6">
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 inline-flex items-center gap-3 w-full justify-center">
                            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            <span className="text-sm font-semibold">Returning to course page in {countdown}s...</span>
                        </div>

                        <div className="flex flex-col gap-3 pt-6">
                            <Button
                                onClick={handleRetake}
                                variant="outline"
                                className="w-full h-12 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-2 rounded-xl transition-all"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Retake Assessment
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/course/${course.slug}`)}
                                className="w-full h-10 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium text-xs gap-2"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                Return to Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // ── Main Assessment View ──
    return (
        <div className="h-screen bg-background text-foreground font-sans flex flex-col overflow-hidden">
            {/* ── Top Header Bar ── */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md py-1.5 px-4 grid grid-cols-3 items-center z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {labStatus === 'running' && (
                        <>
                            <Badge variant="outline" className="gap-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Stable
                            </Badge>
                            <Separator orientation="vertical" className="h-4" />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleRefreshLab}
                                            className="text-[9px] font-bold uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5 text-muted-foreground"
                                        >
                                            <RefreshCcw className="w-3 h-3" />
                                            Reconnect
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Refresh the lab connection</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <Separator orientation="vertical" className="h-4" />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleRetake}
                                            className="text-[9px] font-bold uppercase tracking-widest hover:text-rose-500 transition-colors flex items-center gap-1.5 text-muted-foreground"
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Reset
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Reset session and start over</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <Separator orientation="vertical" className="h-4" />
                        </>
                    )}
                    <Badge variant="outline" className="gap-1.5 text-[9px] font-bold uppercase tracking-widest text-rose-600 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-0.5 animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        Live
                    </Badge>
                </div>

                <div className="flex justify-center">
                    <div className={`text-sm font-mono font-bold px-4 py-1 rounded-lg border shadow-sm min-w-[90px] text-center transition-colors ${timeWarning
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 animate-pulse'
                        : 'bg-muted/50 border-border text-foreground'
                        }`}>
                        <div className="flex items-center justify-center gap-1.5">
                            <Timer className="w-3 h-3" />
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                    {/* Face detection phase indicator */}
                    {labStatus === 'running' && facePhase === 'registering' && (
                        <Badge variant="outline" className="gap-1.5 text-[9px] font-bold uppercase tracking-widest text-blue-600 border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-0.5">
                            <ScanFace className="w-3 h-3" />
                            Face Scan
                        </Badge>
                    )}
                    {labStatus === 'running' && facePhase === 'monitoring' && (
                        <Badge variant="outline" className="gap-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5">
                            <ScanFace className="w-3 h-3" />
                            Face Lock
                        </Badge>
                    )}
                    {isRecording && (
                        <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
                            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">REC</span>
                        </div>
                    )}
                    {labStatus === 'running' && (
                        <Button
                            onClick={handleComplete}
                            size="sm"
                            className="h-7 px-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:bg-primary/90 transition-all active:scale-95"
                        >
                            Finish & Exit
                        </Button>
                    )}
                    <div className="hidden md:block text-[9px] font-mono text-muted-foreground text-right leading-tight">
                        <span className="opacity-60">ID:</span> {userId}<br />
                        <span className="opacity-60">Node:</span> S-01
                    </div>
                </div>
            </header>

            {/* ── Main Content Area ── */}
            <main className="flex-1 overflow-hidden relative bg-zinc-950">

                {/* ── Pre-Session Verification ── */}
                {labStatus === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/50 backdrop-blur-sm">
                        <Card className="max-w-2xl w-full shadow-2xl border-border/50 overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

                            <CardHeader className="text-center pt-10 pb-6 space-y-4">
                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-primary/20">
                                    <ShieldCheck className="w-8 h-8 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl font-black tracking-tight uppercase">
                                        {course.title} Lab
                                    </CardTitle>
                                    <CardDescription className="text-xs font-semibold uppercase tracking-widest">
                                        Pre-Session Security Verification
                                    </CardDescription>
                                </div>
                            </CardHeader>

                            <CardContent className="px-8 pb-8 space-y-6">
                                {/* Permission Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { key: 'screen', label: 'Screen Sharing', icon: Monitor, granted: permissions.screen, onClick: requestScreen },
                                        { key: 'media', label: 'Media Access', icon: Camera, secondIcon: Mic, granted: permissions.camera && permissions.mic, onClick: requestMedia },
                                        { key: 'clipboard', label: 'Clipboard', icon: Clipboard, granted: permissions.clipboard, onClick: requestClipboard },
                                        { key: 'fullscreen', label: 'Fullscreen', icon: Maximize, granted: permissions.fullscreen, onClick: requestFullscreen },
                                    ].map((perm) => {
                                        const Icon = perm.icon
                                        const SecondIcon = perm.secondIcon
                                        return (
                                            <button
                                                key={perm.key}
                                                onClick={perm.onClick}
                                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 group ${perm.granted
                                                    ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20'
                                                    : 'border-border hover:border-primary/30 bg-muted/20 hover:bg-muted/40'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${perm.granted ? 'bg-emerald-500/10' : 'bg-muted/50 group-hover:bg-primary/10'}`}>
                                                        <Icon className={`w-4 h-4 ${perm.granted ? 'text-emerald-600' : 'text-muted-foreground group-hover:text-primary'}`} />
                                                        {SecondIcon && <SecondIcon className={`w-3 h-3 ml-0.5 ${perm.granted ? 'text-emerald-600' : 'text-muted-foreground group-hover:text-primary'}`} />}
                                                    </div>
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${perm.granted ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground/70'}`}>
                                                        {perm.label}
                                                    </span>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${perm.granted ? 'bg-emerald-500 text-white scale-100' : 'border-2 border-dashed border-muted-foreground/30 scale-90'}`}>
                                                    {perm.granted && <Check className="w-3 h-3" />}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                <Separator />

                                {screenError && (
                                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle className="text-xs font-bold uppercase">Screen Share Error</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            Entire screen must be shared (not a window or tab). Please try again.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Button
                                    onClick={() => setLabStatus('starting')}
                                    disabled={!allPermissionsGranted || isVetting}
                                    className="w-full h-14 font-bold text-sm rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 gap-2"
                                    size="lg"
                                >
                                    {isVetting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Verifying Permissions...</>
                                    ) : allPermissionsGranted ? (
                                        <><Play className="w-4 h-4 fill-current" /> Initialize Lab Session</>
                                    ) : (
                                        <><AlertCircle className="w-4 h-4" /> Grant All Permissions Above</>
                                    )}
                                </Button>

                                <p className="text-[10px] text-muted-foreground font-medium text-center leading-relaxed">
                                    All indicators must be green to initialize the VDI tunnel. Face registration completes in ~20 seconds.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── Lab Starting / Loading ── */}
                {labStatus === 'starting' && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/50 backdrop-blur-sm">
                        <Card className="max-w-md w-full shadow-2xl border-border/50 overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                            <CardContent className="pt-12 pb-10 text-center space-y-8">
                                <div className="relative w-20 h-20 mx-auto">
                                    <Loader2 className="w-20 h-20 text-primary animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-black text-primary">{labProgress}%</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold tracking-tight">Initializing Instance</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                                        Securing cloud node and establishing VDI tunnel...
                                    </p>
                                </div>
                                <Progress value={labProgress} className="h-2 rounded-full w-full max-w-xs mx-auto" />
                                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <Wifi className="w-3 h-3 animate-pulse" />
                                    <span>Establishing secure connection</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── Lab Running ── */}
                {labStatus === 'running' && config && (
                    <div className="absolute inset-0 flex flex-col animate-in fade-in duration-1000">
                        <div className="flex-1 bg-black relative">

                            {/* ── Active Lockdown Overlay ── */}
                            {(!permissions.fullscreen || !permissions.screen) && !isFailed && (
                                <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                                    <Card className="max-w-lg w-full border-rose-200 dark:border-rose-900/40 shadow-2xl overflow-hidden">
                                        <div className="h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600" />
                                        <CardHeader className="text-center pt-10 pb-4 space-y-4">
                                            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-950/30 rounded-full flex items-center justify-center mx-auto ring-2 ring-rose-200 dark:ring-rose-800/50">
                                                <ShieldCheck className="w-10 h-10 text-rose-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <CardTitle className="text-2xl font-black uppercase text-rose-600 tracking-tight">
                                                    Security Lockdown
                                                </CardTitle>
                                                <CardDescription className="text-sm leading-relaxed max-w-sm mx-auto">
                                                    Active proctoring requirements not met. Full entire-screen sharing and fullscreen mode must be maintained.
                                                </CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="px-8 pb-8 space-y-6">
                                            {!permissions.fullscreen && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                    <Alert variant="destructive" className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                                                            {alertReason ? `Security Violation: ${alertReason}` : 'Justification Required'}
                                                        </AlertTitle>
                                                        <AlertDescription className="text-xs">
                                                            Warning {warningCount} of 5 — Provide a reason for the interruption
                                                        </AlertDescription>
                                                    </Alert>
                                                    <Textarea
                                                        value={justification}
                                                        onChange={(e) => setJustification(e.target.value)}
                                                        placeholder="Explain why the monitoring was interrupted..."
                                                        className="min-h-[100px] text-sm resize-none border-rose-200 dark:border-rose-800/40 focus-visible:ring-rose-500/50"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-3">
                                                {!permissions.screen && (
                                                    <Button onClick={requestScreen} variant="destructive" className="w-full h-12 font-bold text-xs uppercase rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] gap-2">
                                                        <Monitor className="w-4 h-4" /> Restore Entire Screen Share
                                                    </Button>
                                                )}
                                                {!permissions.fullscreen && (
                                                    <Button onClick={requestFullscreen} className="w-full h-12 font-bold text-xs uppercase rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] gap-2">
                                                        <Maximize className="w-4 h-4" /> Restore Fullscreen Mode
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                        <CardFooter className="justify-center py-4 bg-muted/30 border-t border-border">
                                            <p className="text-xs text-muted-foreground font-mono">Terminal ID: {userId}</p>
                                        </CardFooter>
                                    </Card>
                                </div>
                            )}

                            {config.labUrl ? (
                                <iframe
                                    key={iframeKey}
                                    src={config.labUrl}
                                    className="absolute inset-0 w-full h-full"
                                    title="Virtual Lab Session"
                                    allow="fullscreen; clipboard-read; clipboard-write; camera; microphone; display-capture"
                                    loading="eager"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                                    <WifiOff className="w-8 h-8 text-muted-foreground" />
                                    <div className="text-center">
                                        <p className="font-bold text-sm">Lab URL Not Found</p>
                                        <p className="text-xs text-muted-foreground mt-1">Check the course configuration file.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Transient Proctoring Warning — Enhanced */}
            {showWarning && (
                <>
                    {/* Full-width top flash bar for critical warnings */}
                    {warningType === 'face-malpractice' && (
                        <div className="fixed top-0 left-0 right-0 z-[110] bg-rose-600 text-white py-2 px-4 text-center animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-center gap-2">
                                <ScanFace className="w-4 h-4 animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-wider">
                                    🚨 Face Malpractice Detected — Warning {warningCount}/5
                                </span>
                                <ScanFace className="w-4 h-4 animate-pulse" />
                            </div>
                        </div>
                    )}

                    {/* Warning card */}
                    <div className={`fixed z-[100] animate-in duration-500 ${warningType === 'face-malpractice'
                        ? 'top-14 right-6 left-6 md:left-auto md:max-w-lg slide-in-from-top-4'
                        : 'top-20 right-6 max-w-sm slide-in-from-right-10'
                        }`}>
                        <Card className={`shadow-2xl p-4 flex items-start gap-4 border-l-4 ${warningType === 'face-malpractice'
                            ? 'border-rose-600 bg-rose-50 dark:bg-rose-950 ring-2 ring-rose-500/30'
                            : 'border-rose-500 bg-white dark:bg-rose-950'
                            }`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${warningType === 'face-malpractice'
                                ? 'bg-rose-600 animate-bounce'
                                : 'bg-rose-600 animate-pulse'
                                }`}>
                                {warningType === 'face-malpractice'
                                    ? <ScanFace className="w-7 h-7 text-white" />
                                    : <ShieldAlert className="w-6 h-6 text-white" />
                                }
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-0">
                                <h4 className={`font-black uppercase tracking-tight ${warningType === 'face-malpractice'
                                    ? 'text-base text-rose-700 dark:text-rose-400'
                                    : 'text-sm text-rose-600'
                                    }`}>
                                    {warningType === 'face-malpractice' ? '🚨 Face Malpractice' : 'Security Violation'}
                                </h4>
                                <p className={`font-bold text-slate-900 dark:text-rose-100 leading-tight ${warningType === 'face-malpractice' ? 'text-xs' : 'text-[11px] uppercase'
                                    }`}>
                                    {alertReason || "Illegal navigation or activity detected."}
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <Progress value={(warningCount / 5) * 100} className="h-1.5 flex-1" />
                                    <span className="text-[10px] font-bold text-rose-600 whitespace-nowrap">
                                        {warningCount}/5
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">
                                    {warningCount >= 4 ? '⚠️ FINAL WARNING — Next violation terminates session' : `Warning ${warningCount} of 5. Session at risk.`}
                                </p>
                            </div>
                        </Card>
                    </div>
                </>
            )}

            {/* Hidden Canvas for AI Processing */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}
