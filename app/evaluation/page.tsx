"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Play, Video, Monitor, ArrowLeft, Clock,
    User, ShieldCheck, ShieldAlert,
    Download, LayoutGrid, List as ListIcon, RefreshCcw,
    Eye, ChevronRight, Folder, AlertTriangle,
    ScanFace, Maximize, EyeOff, MessageSquareWarning,
    Timer, ChevronDown, ChevronUp
} from "lucide-react"
import { useRouter } from "next/navigation"

interface Session {
    id: string;
    name: string;
    timestamp: string;
}

interface Chunk {
    name: string;
    url: string;
    type: 'screen' | 'camera';
    timestamp: string;
    size?: number;
    created?: string;
}

interface ProctoringLog {
    warningCount: number;
    type: string;
    duration: string; // HH:mm:ss from lab start
    timestamp: string; // clock time string
    justification: string;
}

function formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return "0 B"
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatTimestamp(ts: string): string {
    if (!ts) return "—"
    try {
        const d = new Date(ts)
        if (isNaN(d.getTime())) return ts
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
        return ts
    }
}

function formatSessionDate(name: string): string {
    const parts = name.split('_')
    if (parts.length >= 4) {
        const datePart = parts[2]
        const timePart = parts[3]?.replace(/-/g, ':')
        return `${datePart} ${timePart}`
    }
    return name
}

/** Parse "HH:mm:ss" duration string to total seconds */
function durationToSeconds(duration: string): number {
    if (!duration) return 0
    const parts = duration.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] || 0
}

/** Get icon and color for a proctoring event type */
function getEventStyle(type: string): { icon: typeof ShieldAlert; color: string; bg: string; label: string } {
    const t = type.toLowerCase()
    if (t.includes('face-malpractice') || t.includes('different person')) {
        return { icon: ScanFace, color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30', label: 'Face Malpractice' }
    }
    if (t.includes('multiple') || t.includes('talking')) {
        return { icon: ScanFace, color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30', label: 'Multiple Faces / Talking' }
    }
    if (t.includes('fullscreen')) {
        return { icon: Maximize, color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', label: 'Fullscreen Exit' }
    }
    if (t.includes('visibility')) {
        return { icon: EyeOff, color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30', label: 'Tab Switch' }
    }
    if (t.includes('ai-alert')) {
        return { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', label: 'AI Alert' }
    }
    return { icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30', label: 'Violation' }
}

export default function EvaluationPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [selectedSession, setSelectedSession] = useState<string | null>(null)
    const [chunks, setChunks] = useState<Chunk[]>([])
    const [activeChunk, setActiveChunk] = useState<Chunk | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingChunks, setIsLoadingChunks] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
    const [filterType, setFilterType] = useState<'all' | 'screen' | 'camera'>('all')

    // Proctoring logs
    const [proctoringLogs, setProctoringLogs] = useState<ProctoringLog[]>([])
    const [isLoadingLogs, setIsLoadingLogs] = useState(false)
    const [currentVideoTime, setCurrentVideoTime] = useState(0)
    const [activeLogIndex, setActiveLogIndex] = useState(-1)
    const [logsExpanded, setLogsExpanded] = useState(true)

    const videoRef = useRef<HTMLVideoElement>(null)
    const logScrollRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useEffect(() => {
        fetchSessions()
    }, [])

    const fetchSessions = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/proctoring/sessions')
            const data = await res.json()
            if (data.success) setSessions(data.sessions)
        } catch (err) {
            console.error("Failed to fetch sessions", err)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchChunks = async (folder: string) => {
        setSelectedSession(folder)
        setChunks([])
        setActiveChunk(null)
        setProctoringLogs([])
        setIsLoadingChunks(true)
        setIsLoadingLogs(true)
        try {
            // Fetch chunks
            const res = await fetch(`/api/proctoring/sessions/${folder}`)
            const data = await res.json()
            if (data.success) {
                setChunks(data.chunks)
                if (data.chunks.length > 0) setActiveChunk(data.chunks[0])
            }

            // Fetch proctoring logs
            const logRes = await fetch(`/api/proctoring/logs/${folder}`)
            const logData = await logRes.json()
            if (logData.success && logData.logs) {
                setProctoringLogs(logData.logs)
            }
        } catch (err) {
            console.error("Failed to fetch session data", err)
        } finally {
            setIsLoadingChunks(false)
            setIsLoadingLogs(false)
        }
    }

    const handleBack = () => {
        if (selectedSession) {
            setSelectedSession(null)
            setChunks([])
            setActiveChunk(null)
            setProctoringLogs([])
            setFilterType('all')
            setCurrentVideoTime(0)
            setActiveLogIndex(-1)
        } else {
            router.back()
        }
    }

    // Track video time and highlight matching log entry
    const handleTimeUpdate = useCallback(() => {
        if (!videoRef.current) return
        const currentTime = videoRef.current.currentTime
        setCurrentVideoTime(currentTime)

        // Find the most recent log entry at or before the current time
        let bestIdx = -1
        for (let i = 0; i < proctoringLogs.length; i++) {
            const logSeconds = durationToSeconds(proctoringLogs[i].duration)
            if (logSeconds <= currentTime) {
                bestIdx = i
            } else {
                break
            }
        }

        if (bestIdx !== activeLogIndex) {
            setActiveLogIndex(bestIdx)
            // Auto-scroll to the active log entry
            if (bestIdx >= 0 && logScrollRef.current) {
                const el = logScrollRef.current.querySelector(`[data-log-idx="${bestIdx}"]`)
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                }
            }
        }
    }, [proctoringLogs, activeLogIndex])

    // Seek video when clicking a log entry
    const seekToLog = (log: ProctoringLog) => {
        if (videoRef.current) {
            const seconds = durationToSeconds(log.duration)
            videoRef.current.currentTime = seconds
            videoRef.current.play()
        }
    }

    const filteredChunks = chunks.filter(c => filterType === 'all' || c.type === filterType)
    const activeIndex = activeChunk ? filteredChunks.findIndex(c => c.name === activeChunk.name) : -1

    return (
        <div className="h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col overflow-hidden">
            {/* ── Header ── */}
            <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleBack}
                                    className="h-8 w-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{selectedSession ? 'Back to sessions' : 'Go back'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Separator orientation="vertical" className="h-5 bg-zinc-800" />
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                            <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight leading-none">
                                Security Evaluation Center
                            </h1>
                            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                                Proctoring Audit & Analysis
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedSession && proctoringLogs.length > 0 && (
                        <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/20 px-2.5 py-1 text-[10px] font-semibold h-8 gap-1.5">
                            <ShieldAlert className="w-3 h-3" />
                            {proctoringLogs.length} Violation{proctoringLogs.length !== 1 ? 's' : ''}
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={selectedSession ? () => fetchChunks(selectedSession) : fetchSessions}
                        className="h-8 gap-1.5 text-[10px] font-semibold border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300"
                    >
                        <RefreshCcw className="w-3 h-3" />
                        Refresh
                    </Button>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold h-8">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                        System Active
                    </Badge>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="flex-1 flex overflow-hidden">
                {!selectedSession ? (
                    /* ══ SESSION BROWSER ══ */
                    <div className="flex-1 overflow-auto">
                        <div className="max-w-5xl mx-auto p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-bold tracking-tight">Recording Sessions</h2>
                                    <p className="text-xs text-zinc-500">
                                        {sessions.length} session{sessions.length !== 1 ? 's' : ''} available for review
                                    </p>
                                </div>
                                <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                                    <Button
                                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setViewMode('list')}
                                        className={`h-7 gap-1.5 text-[10px] font-semibold rounded-md ${viewMode === 'list' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        <ListIcon className="w-3 h-3" />
                                        List
                                    </Button>
                                    <Button
                                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setViewMode('grid')}
                                        className={`h-7 gap-1.5 text-[10px] font-semibold rounded-md ${viewMode === 'grid' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        <LayoutGrid className="w-3 h-3" />
                                        Grid
                                    </Button>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} className="h-20 w-full rounded-xl bg-zinc-900" />
                                    ))}
                                </div>
                            ) : sessions.length === 0 ? (
                                <Card className="bg-zinc-900/50 border-zinc-800">
                                    <CardContent className="py-16 text-center space-y-4">
                                        <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto">
                                            <Monitor className="w-7 h-7 text-zinc-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-base text-zinc-300">No Sessions Found</h3>
                                            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                                                Recordings will appear here once candidates start their assessments.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : viewMode === 'list' ? (
                                <div className="space-y-2">
                                    {sessions.map(session => (
                                        <button
                                            key={session.id}
                                            onClick={() => fetchChunks(session.id)}
                                            className="w-full group flex items-center justify-between p-4 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/30 rounded-xl transition-all text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 transition-colors">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">{session.name}</h4>
                                                    <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatSessionDate(session.name)}
                                                        </span>
                                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                                        <span className="flex items-center gap-1 text-rose-400/70">
                                                            <ShieldAlert className="w-3 h-3" />
                                                            Evidence Logged
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[9px] font-medium border-zinc-700 text-zinc-500 hidden sm:flex">
                                                    <Folder className="w-3 h-3 mr-1" />
                                                    {session.id}
                                                </Badge>
                                                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sessions.map(session => (
                                        <Card
                                            key={session.id}
                                            onClick={() => fetchChunks(session.id)}
                                            className="bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                        >
                                            <CardContent className="p-5 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 transition-colors">
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] font-medium border-zinc-700 text-zinc-500">
                                                        {formatSessionDate(session.name)}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-sm text-zinc-200 leading-tight truncate">{session.name}</h4>
                                                    <p className="text-[10px] text-zinc-500">Session Evidence Available</p>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    className="w-full text-[10px] font-semibold h-9 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 gap-1.5"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    Open Review
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ══ SESSION DETAIL / PLAYER ══ */
                    <div className="flex-1 flex overflow-hidden">
                        {/* ── Left Sidebar: Chunks ── */}
                        <aside className="w-56 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900/40">
                            <div className="p-3 space-y-2.5 flex-shrink-0 border-b border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Evidence</h3>
                                    <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[9px] font-mono h-5 px-1.5">
                                        {filteredChunks.length}
                                    </Badge>
                                </div>
                                <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
                                    {(['all', 'screen', 'camera'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setFilterType(type)}
                                            className={`flex-1 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider transition-all ${filterType === type
                                                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-2 space-y-1">
                                    {isLoadingChunks ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <Skeleton key={i} className="h-14 w-full rounded-lg bg-zinc-800/50" />
                                        ))
                                    ) : filteredChunks.length === 0 ? (
                                        <div className="text-center py-6">
                                            <p className="text-[10px] text-zinc-500">No chunks</p>
                                        </div>
                                    ) : (
                                        filteredChunks.map((chunk, idx) => {
                                            const isActive = activeChunk?.name === chunk.name
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveChunk(chunk)}
                                                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center gap-2.5 ${isActive
                                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                                        : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-zinc-700'
                                                        }`}
                                                >
                                                    <div className={`w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center transition-colors ${isActive
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-zinc-800 text-zinc-500'
                                                        }`}>
                                                        {chunk.type === 'screen'
                                                            ? <Monitor className="w-3 h-3" />
                                                            : <Video className="w-3 h-3" />
                                                        }
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className={`text-[10px] font-bold uppercase truncate ${isActive ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                                                {chunk.type} #{idx + 1}
                                                            </span>
                                                            {isActive && (
                                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        <p className="text-[9px] text-zinc-500 font-mono truncate mt-0.5">
                                                            {chunk.size ? formatFileSize(chunk.size) : formatTimestamp(chunk.timestamp)}
                                                        </p>
                                                    </div>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </aside>

                        {/* ── Center: Video Player ── */}
                        <div className="flex-1 flex flex-col min-w-0 bg-black">
                            {activeChunk ? (
                                <>
                                    {/* Video Player */}
                                    <div className="flex-1 relative">
                                        <video
                                            ref={videoRef}
                                            key={activeChunk.name}
                                            src={`/api/proctoring/files/${selectedSession}/${activeChunk.name}`}
                                            controls
                                            autoPlay
                                            onTimeUpdate={handleTimeUpdate}
                                            className="absolute inset-0 w-full h-full object-contain bg-black"
                                        />
                                        {/* Overlay badges */}
                                        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                                            <Badge className="bg-black/70 backdrop-blur-md border-zinc-700/50 text-[9px] font-bold uppercase px-2.5 py-1 h-auto text-emerald-400">
                                                {activeChunk.type === 'screen' ? (
                                                    <><Monitor className="w-3 h-3 mr-1" /> Screen</>
                                                ) : (
                                                    <><Video className="w-3 h-3 mr-1" /> Camera</>
                                                )}
                                            </Badge>
                                            <Badge className="bg-black/70 backdrop-blur-md border-zinc-700/50 text-[9px] font-bold px-2.5 py-1 h-auto text-zinc-400">
                                                {activeIndex + 1} / {filteredChunks.length}
                                            </Badge>
                                        </div>

                                        {/* Active violation indicator on video */}
                                        {activeLogIndex >= 0 && proctoringLogs[activeLogIndex] && (
                                            <div className="absolute top-3 right-3 pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div className="bg-rose-600/90 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg shadow-rose-900/40">
                                                    <ShieldAlert className="w-3.5 h-3.5 text-white animate-pulse" />
                                                    <div>
                                                        <p className="text-[9px] font-black text-white uppercase tracking-wide">
                                                            Warning #{proctoringLogs[activeLogIndex].warningCount}
                                                        </p>
                                                        <p className="text-[8px] text-rose-100/80 font-medium">
                                                            @ {proctoringLogs[activeLogIndex].duration}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom info bar */}
                                    <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-4 py-2 flex items-center justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-zinc-200 truncate">{activeChunk.name}</p>
                                            <p className="text-[9px] text-zinc-500 font-mono truncate">
                                                record/{selectedSession}/video/
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 gap-1.5 text-[9px] font-semibold border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300"
                                                            onClick={() => {
                                                                const a = document.createElement('a')
                                                                a.href = `/api/proctoring/files/${selectedSession}/${activeChunk.name}`
                                                                a.download = activeChunk.name
                                                                a.click()
                                                            }}
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            {activeChunk.size ? formatFileSize(activeChunk.size) : 'Download'}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Download source recording</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <Button
                                                size="sm"
                                                className="h-7 gap-1.5 text-[9px] font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                                            >
                                                <ShieldAlert className="w-3 h-3" />
                                                Flag
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
                                        <Play className="w-8 h-8 text-zinc-600 fill-current" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <h3 className="font-bold text-sm text-zinc-300">Select a Segment</h3>
                                        <p className="text-xs text-zinc-500 max-w-xs">
                                            Choose a recording segment from the sidebar to begin playback.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Right Panel: Proctoring Event Log ── */}
                        <aside className="w-80 flex-shrink-0 border-l border-zinc-800 flex flex-col bg-zinc-900/30">
                            {/* Panel Header */}
                            <div className="p-3 flex-shrink-0 border-b border-zinc-800">
                                <button
                                    onClick={() => setLogsExpanded(!logsExpanded)}
                                    className="w-full flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-rose-500/15 flex items-center justify-center">
                                            <MessageSquareWarning className="w-3 h-3 text-rose-400" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                                                Proctoring Events
                                            </h3>
                                            <p className="text-[9px] text-zinc-500 font-mono">
                                                {proctoringLogs.length} event{proctoringLogs.length !== 1 ? 's' : ''} detected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {proctoringLogs.length > 0 && (
                                            <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/20 text-[9px] font-bold h-5 px-1.5">
                                                {proctoringLogs.length}
                                            </Badge>
                                        )}
                                        {logsExpanded ? (
                                            <ChevronUp className="w-3 h-3 text-zinc-500" />
                                        ) : (
                                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                                        )}
                                    </div>
                                </button>
                            </div>

                            {/* Event Timeline */}
                            {logsExpanded && (
                                <ScrollArea className="flex-1">
                                    <div ref={logScrollRef} className="p-2 space-y-1">
                                        {isLoadingLogs ? (
                                            Array.from({ length: 4 }).map((_, i) => (
                                                <Skeleton key={i} className="h-16 w-full rounded-lg bg-zinc-800/50" />
                                            ))
                                        ) : proctoringLogs.length === 0 ? (
                                            <div className="py-12 text-center space-y-3">
                                                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto">
                                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-zinc-400">No Violations</p>
                                                    <p className="text-[10px] text-zinc-600 max-w-[200px] mx-auto">
                                                        No proctoring events were logged for this session.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            proctoringLogs.map((log, idx) => {
                                                const style = getEventStyle(log.type)
                                                const Icon = style.icon
                                                const logSeconds = durationToSeconds(log.duration)
                                                const isActive = idx === activeLogIndex
                                                const isPast = logSeconds <= currentVideoTime
                                                const isFuture = logSeconds > currentVideoTime

                                                return (
                                                    <button
                                                        key={idx}
                                                        data-log-idx={idx}
                                                        onClick={() => seekToLog(log)}
                                                        className={`w-full text-left p-2.5 rounded-lg border transition-all group relative ${isActive
                                                            ? `${style.bg} ring-1 ring-current/20`
                                                            : isPast
                                                                ? 'bg-zinc-800/20 border-zinc-800/50 hover:bg-zinc-800/40'
                                                                : 'bg-transparent border-transparent hover:bg-zinc-800/30 hover:border-zinc-800'
                                                            }`}
                                                    >
                                                        {/* Timeline connector line */}
                                                        {idx < proctoringLogs.length - 1 && (
                                                            <div className="absolute left-[18px] top-[38px] bottom-[-6px] w-px bg-zinc-800" />
                                                        )}

                                                        <div className="flex gap-2.5 relative">
                                                            {/* Icon */}
                                                            <div className={`w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center transition-all ${isActive
                                                                ? `${style.color} bg-current/10`
                                                                : isPast
                                                                    ? 'bg-zinc-800 text-zinc-500'
                                                                    : 'bg-zinc-800/50 text-zinc-600'
                                                                }`}>
                                                                <Icon className={`w-3.5 h-3.5 ${isActive ? style.color : ''}`} />
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0 space-y-1">
                                                                {/* Header row */}
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? style.color : 'text-zinc-400'}`}>
                                                                        Warning #{log.warningCount}
                                                                    </span>
                                                                    <span
                                                                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md transition-colors flex items-center gap-1 ${isActive
                                                                            ? 'bg-white/10 text-white'
                                                                            : 'bg-zinc-800/50 text-zinc-500 group-hover:bg-zinc-800 group-hover:text-zinc-300'
                                                                            }`}
                                                                        title="Click to seek"
                                                                    >
                                                                        <Timer className="w-2.5 h-2.5" />
                                                                        {log.duration}
                                                                    </span>
                                                                </div>

                                                                {/* Type / reason */}
                                                                <p className={`text-[10px] font-semibold leading-tight ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>
                                                                    {log.type}
                                                                </p>

                                                                {/* Clock time */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[8px] text-zinc-600 font-mono">
                                                                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                                                        {log.timestamp}
                                                                    </span>
                                                                    {log.justification && log.justification !== 'N/A' && (
                                                                        <>
                                                                            <span className="w-0.5 h-0.5 bg-zinc-700 rounded-full" />
                                                                            <span className="text-[8px] text-zinc-500 truncate italic">
                                                                                &ldquo;{log.justification}&rdquo;
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            )}

                            {/* Summary Footer */}
                            {proctoringLogs.length > 0 && (
                                <div className="flex-shrink-0 border-t border-zinc-800 p-3 space-y-2">
                                    <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Summary</h4>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {(() => {
                                            const counts = {
                                                face: 0,
                                                fullscreen: 0,
                                                other: 0
                                            }
                                            proctoringLogs.forEach(l => {
                                                const t = l.type.toLowerCase()
                                                if (t.includes('face') || t.includes('multiple') || t.includes('talking') || t.includes('person')) counts.face++
                                                else if (t.includes('fullscreen') || t.includes('visibility')) counts.fullscreen++
                                                else counts.other++
                                            })
                                            return (
                                                <>
                                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 text-center">
                                                        <ScanFace className="w-3.5 h-3.5 text-rose-400 mx-auto" />
                                                        <p className="text-[10px] font-black text-rose-400 mt-1">{counts.face}</p>
                                                        <p className="text-[7px] text-rose-400/60 font-bold uppercase">Face</p>
                                                    </div>
                                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                                                        <Maximize className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                                                        <p className="text-[10px] font-black text-amber-400 mt-1">{counts.fullscreen}</p>
                                                        <p className="text-[7px] text-amber-400/60 font-bold uppercase">Screen</p>
                                                    </div>
                                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-center">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-purple-400 mx-auto" />
                                                        <p className="text-[10px] font-black text-purple-400 mt-1">{counts.other}</p>
                                                        <p className="text-[7px] text-purple-400/60 font-bold uppercase">Other</p>
                                                    </div>
                                                </>
                                            )
                                        })()}
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                )}
            </main>
        </div>
    )
}
