"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
    Eye, ChevronRight, Folder
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
    // Extract date from session name like "user1_999999_2026-02-07_11-27-10"
    const parts = name.split('_')
    if (parts.length >= 4) {
        const datePart = parts[2] // "2026-02-07"
        const timePart = parts[3]?.replace(/-/g, ':') // "11:27:10"
        return `${datePart} ${timePart}`
    }
    return name
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
        setIsLoadingChunks(true)
        try {
            const res = await fetch(`/api/proctoring/sessions/${folder}`)
            const data = await res.json()
            if (data.success) {
                setChunks(data.chunks)
                if (data.chunks.length > 0) setActiveChunk(data.chunks[0])
            }
        } catch (err) {
            console.error("Failed to fetch chunks", err)
        } finally {
            setIsLoadingChunks(false)
        }
    }

    const handleBack = () => {
        if (selectedSession) {
            setSelectedSession(null)
            setChunks([])
            setActiveChunk(null)
            setFilterType('all')
        } else {
            router.back()
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchSessions}
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
                            {/* Title bar */}
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

                            {/* Content */}
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
                        {/* ── Sidebar ── */}
                        <aside className="w-72 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900/40">
                            <div className="p-4 space-y-3 flex-shrink-0 border-b border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-zinc-400">Evidence Chunks</h3>
                                    <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[9px] font-mono h-5 px-1.5">
                                        {filteredChunks.length}
                                    </Badge>
                                </div>
                                {/* Filter tabs */}
                                <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
                                    {(['all', 'screen', 'camera'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setFilterType(type)}
                                            className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${filterType === type
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
                                <div className="p-3 space-y-1.5">
                                    {isLoadingChunks ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <Skeleton key={i} className="h-16 w-full rounded-lg bg-zinc-800/50" />
                                        ))
                                    ) : filteredChunks.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-xs text-zinc-500">No chunks match filter</p>
                                        </div>
                                    ) : (
                                        filteredChunks.map((chunk, idx) => {
                                            const isActive = activeChunk?.name === chunk.name
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveChunk(chunk)}
                                                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${isActive
                                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                                        : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-zinc-700'
                                                        }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center transition-colors ${isActive
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-zinc-800 text-zinc-500'
                                                        }`}>
                                                        {chunk.type === 'screen'
                                                            ? <Monitor className="w-3.5 h-3.5" />
                                                            : <Video className="w-3.5 h-3.5" />
                                                        }
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
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

                        {/* ── Player Area ── */}
                        <div className="flex-1 flex flex-col min-w-0 bg-black">
                            {activeChunk ? (
                                <>
                                    {/* Video Player */}
                                    <div className="flex-1 relative">
                                        <video
                                            key={activeChunk.name}
                                            src={`/api/proctoring/files/${selectedSession}/${activeChunk.name}`}
                                            controls
                                            autoPlay
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
                                    </div>

                                    {/* Bottom info bar */}
                                    <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-zinc-200 truncate">{activeChunk.name}</p>
                                            <p className="text-[10px] text-zinc-500 font-mono truncate">
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
                                                            className="h-8 gap-1.5 text-[10px] font-semibold border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300"
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
                                                className="h-8 gap-1.5 text-[10px] font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                                            >
                                                <ShieldAlert className="w-3 h-3" />
                                                Flag Violation
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
                    </div>
                )}
            </main>
        </div>
    )
}
