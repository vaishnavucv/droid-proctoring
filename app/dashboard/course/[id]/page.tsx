"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Clock, CheckCircle2, AlertCircle, Lock, GraduationCap, ClipboardCheck, ArrowLeft, Shield, Zap, FileText, Timer, Target, Hash, TrendingUp, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface CourseConfig {
    startDate: string;
    endDate: string;
    allowedTimeMinutes: number;
    maxAttempts: number;
}

const courseDetails: Record<string, { title: string, level: string, courseId: string }> = {
    "ubuntu-linux": { title: "Ubuntu Linux Administrator", level: "Expert Assessment", courseId: "111111" },
    "cybersecurity-101": { title: "Cybersecurity 101", level: "Beginner Assessment", courseId: "222222" },
    "python-101": { title: "Python 101", level: "Beginner Assessment", courseId: "333333" },
    "devsecops": { title: "DevSecOps Engineer", level: "Specialist Assessment", courseId: "444444" },
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [config, setConfig] = useState<CourseConfig | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [user, setUser] = useState<{ userId: string, username: string } | null>(null)
    const [dbStatus, setDbStatus] = useState({
        status: 'not_started',
        attempts_taken: 0,
        score: null as number | null,
        result: null as string | null
    })
    const router = useRouter()

    const course = courseDetails[id] || { title: "Unknown Course", level: "", courseId: "000000" }

    useEffect(() => {
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser)
            setUser(parsedUser)
            fetchStatus(parsedUser.userId, course.courseId)
        }

        async function loadConfig() {
            try {
                const response = await fetch('/course-config.json')
                const data = await response.json()
                if (data[id]) {
                    setConfig(data[id])
                }
            } catch (err) {
                console.error("Failed to load config", err)
            } finally {
                setIsLoading(false)
            }
        }
        loadConfig()
    }, [id, course.courseId])

    const fetchStatus = async (userId: string, courseId: string) => {
        try {
            const res = await fetch(`/api/assessment/status?userId=${userId}&courseId=${courseId}`)
            const data = await res.json()
            if (data.success) {
                setDbStatus({
                    status: data.status,
                    attempts_taken: data.attempts_taken,
                    score: data.score,
                    result: data.result
                })
            }
        } catch (err) {
            console.error("Failed to fetch status", err)
        }
    }

    const handleStart = async () => {
        if (!user || !config) {
            alert("Please login again.")
            return
        }

        if (dbStatus.attempts_taken >= config.maxAttempts) {
            alert("No attempts remaining.")
            return
        }

        setIsSubmitting(true)
        try {
            const startRes = await fetch('/api/assessment/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.userId,
                    courseId: course.courseId,
                    maxAttempts: config.maxAttempts
                }),
            })

            if (startRes.ok) {
                router.push(`/assessment/${course.courseId}/${user.userId}`)
            } else {
                const error = await startRes.json()
                alert(error.message || "Failed to start assessment")
            }

        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReset = async () => {
        if (!user || !config) return;

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/assessment/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.userId,
                    courseId: course.courseId
                }),
            })

            if (res.ok) {
                // Refresh status and state
                await fetchStatus(user.userId, course.courseId)
            } else {
                alert("Failed to reset assessment")
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <header className="border-b border-border bg-card py-4 px-6 flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                </header>
                <main className="flex-1 flex flex-col items-center p-8 max-w-5xl mx-auto w-full">
                    <div className="text-center py-12 space-y-8 w-full">
                        <Skeleton className="h-1.5 w-20 mx-auto rounded-full" />
                        <Skeleton className="h-16 w-96 mx-auto" />
                        <div className="flex gap-3 justify-center">
                            <Skeleton className="h-8 w-40" />
                            <Skeleton className="h-8 w-28" />
                        </div>
                        <Skeleton className="h-96 w-full max-w-2xl mx-auto rounded-2xl" />
                    </div>
                </main>
            </div>
        )
    }

    const attemptsRemaining = config ? Math.max(0, config.maxAttempts - dbStatus.attempts_taken) : 0
    const isLocked = attemptsRemaining === 0 || dbStatus.status === 'completed'

    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
            {/* ── Header ── */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md py-4 px-6 flex items-center justify-between sticky top-0 z-20">
                <Link href="/dashboard" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group">
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Back to Dashboard
                </Link>
                <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold tracking-tight">Proctoring Academy</span>
                </div>
                <div className="w-20" />
            </header>

            {/* ── Main Content ── */}
            <main className="flex-1 flex flex-col items-center p-8 max-w-5xl mx-auto w-full">
                <div className="text-center py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                    {/* ── Title Section ── */}
                    <div className="space-y-5">
                        <div className="w-20 h-1.5 bg-primary/20 mx-auto rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-1/2 rounded-full animate-pulse" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight">
                            {course.title}
                        </h1>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <Badge variant="outline" className="px-4 py-1.5 bg-muted/50 border-border text-foreground/70 font-semibold text-xs gap-1.5">
                                <Target className="w-3 h-3" />
                                {course.level}
                            </Badge>
                            <Badge variant="secondary" className="px-4 py-1.5 font-mono text-xs gap-1.5">
                                <Hash className="w-3 h-3" />
                                {course.courseId}
                            </Badge>
                            {dbStatus.status === 'completed' && (
                                <Badge className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-semibold text-xs">
                                    <ClipboardCheck className="w-3 h-3" />
                                    Official Record
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* ── Main Card ── */}
                    <Card className="max-w-2xl mx-auto border border-border bg-card shadow-xl relative overflow-hidden">
                        <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        {/* ── Locked Overlay ── */}
                        {isLocked && (
                            <div className="absolute inset-0 bg-background/98 z-10 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-700">
                                {dbStatus.status === 'completed' ? (
                                    <div className="w-full max-w-md space-y-8">
                                        <div className="space-y-3">
                                            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-primary/20">
                                                <FileText className="w-7 h-7 text-primary" />
                                            </div>
                                            <h3 className="text-2xl font-black tracking-tight">Assessment Report</h3>
                                            <Separator className="max-w-12 mx-auto" />
                                        </div>

                                        <Card className="border-border shadow-sm overflow-hidden text-left">
                                            <div className="bg-muted/40 px-6 py-3 border-b border-border flex justify-between items-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transcript Data</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                    REF: {course.courseId}-{user?.userId}
                                                </span>
                                            </div>
                                            <Table>
                                                <TableBody>
                                                    <TableRow>
                                                        <TableCell className="font-semibold text-muted-foreground text-sm py-5">
                                                            Performance Score
                                                        </TableCell>
                                                        <TableCell className="text-right font-black font-mono text-2xl py-5">
                                                            {dbStatus.score}%
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-semibold text-muted-foreground text-sm py-5">
                                                            Certification Status
                                                        </TableCell>
                                                        <TableCell className={`text-right font-black text-2xl py-5 ${dbStatus.result === 'Pass'
                                                            ? 'text-emerald-600'
                                                            : 'text-rose-600'
                                                            }`}>
                                                            {dbStatus.result}
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-semibold text-muted-foreground text-sm py-5">
                                                            Attempt Record
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold font-mono text-sm py-5">
                                                            {dbStatus.attempts_taken} Attempt(s)
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </Card>

                                        <div className="flex flex-col gap-3 py-4 w-full">
                                            <Button
                                                onClick={handleReset}
                                                disabled={isSubmitting}
                                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-2 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                {isSubmitting ? "Processing..." : "Retake Assessment"}
                                            </Button>

                                            <Button
                                                variant="outline"
                                                onClick={() => router.push('/dashboard')}
                                                className="w-full h-10 border-border text-muted-foreground hover:text-foreground font-semibold text-xs gap-2"
                                            >
                                                <ArrowLeft className="w-3 h-3" />
                                                Return to Dashboard
                                            </Button>
                                        </div>

                                        <p className="text-xs text-muted-foreground leading-relaxed mt-4">
                                            This transcript is an official record of the candidate&apos;s performance.
                                            All results are securely locked and verified.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center space-y-6">
                                        <div className="w-16 h-16 bg-destructive/5 rounded-2xl flex items-center justify-center border border-destructive/10">
                                            <Lock className="w-8 h-8 text-destructive/40" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black tracking-tight">Attempts Exhausted</h3>
                                            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                                                The maximum limit of <strong>{config?.maxAttempts}</strong> attempts has been reached without a passing record.
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-3 pt-6 w-full">
                                            <Button
                                                onClick={handleReset}
                                                disabled={isSubmitting}
                                                variant="default"
                                                className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm gap-2 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                {isSubmitting ? "Resetting..." : "Reset and Try Again"}
                                            </Button>

                                            <Button
                                                variant="outline"
                                                onClick={() => router.push('/dashboard')}
                                                className="w-full h-10 border-border text-muted-foreground hover:text-foreground font-semibold text-xs gap-2"
                                            >
                                                <ArrowLeft className="w-3 h-3" />
                                                Return to Dashboard
                                            </Button>
                                        </div>
                                        <Separator className="max-w-20" />
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contact Academic Support</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Candidate Briefing ── */}
                        <CardHeader className="text-left border-b border-border py-6 px-8">
                            <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-950/30 rounded-lg flex items-center justify-center">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                </div>
                                Candidate Briefing
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="text-left py-8 px-8 space-y-8">
                            {/* ── Stats Grid ── */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {[
                                    { label: 'Time Limit', value: `${config?.allowedTimeMinutes}m`, icon: Timer, color: 'text-foreground' },
                                    { label: 'History', value: dbStatus.attempts_taken, icon: TrendingUp, color: 'text-amber-600' },
                                    { label: 'Available', value: attemptsRemaining, icon: Zap, color: 'text-emerald-600' },
                                    { label: 'Quota', value: config?.maxAttempts, icon: Target, color: 'text-foreground' },
                                ].map((stat) => {
                                    const Icon = stat.icon
                                    return (
                                        <div key={stat.label} className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <Icon className="w-3 h-3 text-muted-foreground" />
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{stat.label}</p>
                                            </div>
                                            <p className={`text-3xl font-black font-mono tracking-tighter ${stat.color}`}>
                                                {stat.value}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>

                            <Separator />

                            {/* ── Requirements ── */}
                            <div className="space-y-4">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Shield className="w-3 h-3" />
                                    Official Requirements
                                </p>
                                <ul className="space-y-3">
                                    {[
                                        <>Candidate Identity verified as <span className="text-foreground font-bold font-mono">{user?.userId}</span></>,
                                        <>Each session activation will consume exactly one attempt quota.</>,
                                        <>Real-time persistence active. Exiting will not halt the official timer.</>,
                                    ].map((text, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                                            <div className="w-1.5 h-1.5 bg-primary/50 rounded-full mt-2 flex-shrink-0" />
                                            <span>{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </CardContent>

                        {/* ── Action Footer ── */}
                        <CardFooter className="px-8 py-6 bg-muted/20 border-t border-border flex justify-between items-center">
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Status</p>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-muted-foreground' : 'bg-emerald-500 animate-pulse'}`} />
                                    <p className="text-xs font-bold uppercase tracking-tight">
                                        {isLocked ? 'Locked' : dbStatus.status === 'started' ? 'In Progress' : 'Environment Ready'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {dbStatus.status === 'started' && (
                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                        disabled={isSubmitting}
                                        className="h-14 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs gap-2 rounded-xl"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Reset
                                    </Button>
                                )}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                onClick={handleStart}
                                                disabled={isSubmitting || isLocked}
                                                size="lg"
                                                className={`px-12 h-14 text-sm font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] ${isLocked
                                                    ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                                                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 hover:shadow-xl"
                                                    }`}
                                            >
                                                {isSubmitting ? (
                                                    <span className="flex items-center gap-2">
                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                        </svg>
                                                        Transmitting...
                                                    </span>
                                                ) : isLocked ? (
                                                    dbStatus.status === 'completed' ? "Record Locked" : "Locked"
                                                ) : dbStatus.status === 'started' ? (
                                                    "Resume Session"
                                                ) : (
                                                    "Start Assessment"
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        {!isLocked && (
                                            <TooltipContent>
                                                <p>{dbStatus.status === 'started' ? 'Continue your existing session' : 'This will consume one attempt quota'}</p>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="py-10 border-t border-border bg-card/50">
                <div className="container mx-auto px-8 text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 opacity-20">
                        <GraduationCap className="w-5 h-5" />
                        <Separator className="w-12" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-semibold">
                        Official Transcript System &copy; {new Date().getFullYear()} Proctoring Academy
                    </p>
                </div>
            </footer>
        </div>
    )
}
