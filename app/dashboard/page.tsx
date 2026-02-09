"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { LogOut, BookOpen, Shield, Terminal, ArrowRight, GraduationCap, Hash, ShieldCheck } from "lucide-react"

const courses = [
    {
        id: "ubuntu-linux",
        title: "Ubuntu Linux Administrator",
        level: "Expert Assessment",
        icon: Terminal,
        gradient: "from-orange-500 to-amber-500",
        bgLight: "bg-orange-50 dark:bg-orange-950/20",
        description: "Master enterprise-grade Linux administration and server security."
    },
    {
        id: "cybersecurity-101",
        title: "Cybersecurity 101",
        level: "Beginner Assessment",
        icon: Shield,
        gradient: "from-blue-500 to-cyan-500",
        bgLight: "bg-blue-50 dark:bg-blue-950/20",
        description: "Learn the fundamentals of digital security and threat detection."
    },
    {
        id: "python-101",
        title: "Python 101",
        level: "Beginner Assessment",
        icon: BookOpen,
        gradient: "from-emerald-500 to-teal-500",
        bgLight: "bg-emerald-50 dark:bg-emerald-950/20",
        description: "Start your programming journey with Python and core logic."
    },
    {
        id: "devsecops",
        title: "DevSecOps Engineer",
        level: "Specialist Assessment",
        icon: ShieldCheck,
        gradient: "from-indigo-500 to-purple-500",
        bgLight: "bg-indigo-50 dark:bg-indigo-950/20",
        description: "Deep dive into secure CI/CD pipelines and automated security testing."
    }
]

export default function DashboardPage() {
    const [user, setUser] = useState<{ userId: string, username: string } | null>(null)
    const router = useRouter()

    useEffect(() => {
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
            setUser(JSON.parse(storedUser))
        } else {
            router.push("/")
        }
    }, [router])

    const handleLogout = () => {
        localStorage.removeItem("user")
        router.push("/")
    }

    const initials = user?.username
        ? user.username.substring(0, 2).toUpperCase()
        : "AD"

    if (!user) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <header className="bg-card border-b border-border py-4 px-6">
                    <div className="container mx-auto max-w-6xl flex items-center justify-between">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                </header>
                <main className="flex-1 py-10">
                    <div className="container mx-auto max-w-6xl px-6">
                        <Skeleton className="h-10 w-48 mb-2" />
                        <Skeleton className="h-5 w-72 mb-10" />
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-64 rounded-xl" />
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            {/* ── Header ── */}
            <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <div className="container mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">Proctoring Academy</h1>
                            <p className="text-[10px] text-muted-foreground">Learning Platform</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex flex-col items-end mr-1">
                            <span className="text-[10px] text-muted-foreground font-medium">Candidate</span>
                            <span className="text-sm font-bold text-foreground leading-none">{user.username}</span>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Avatar className="w-9 h-9 border-2 border-primary/20 cursor-default">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>ID: {user.userId}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <Link href="/evaluation">
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-2 h-9 text-xs font-bold"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                <span className="hidden sm:inline">Evaluation Center</span>
                            </Button>
                        </Link>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors gap-2 h-9"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs font-medium">Logout</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* ── Main Content ── */}
            <main className="flex-1 py-10">
                <div className="container mx-auto max-w-6xl px-6">
                    {/* Page Header */}
                    <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-foreground tracking-tight">
                                Dashboard
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Welcome back, <span className="text-foreground font-semibold capitalize">{user.username}</span>. Select an assessment to begin.
                            </p>
                        </div>
                        <Badge variant="outline" className="gap-2 px-4 py-2 bg-primary/5 border-primary/10 self-start md:self-auto">
                            <Hash className="w-3 h-3 text-primary" />
                            <div className="text-left">
                                <p className="text-[9px] font-medium text-muted-foreground leading-none">Candidate ID</p>
                                <p className="text-xs font-mono font-bold text-primary leading-tight">{user.userId}</p>
                            </div>
                        </Badge>
                    </div>

                    {/* ── Course Cards Grid ── */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {courses.map((course) => {
                            const Icon = course.icon
                            return (
                                <Link
                                    key={course.id}
                                    href={`/dashboard/course/${course.id}`}
                                    className="group block"
                                >
                                    <Card className="h-full border border-border bg-card hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden">
                                        <div className={`h-1 bg-gradient-to-r ${course.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${course.gradient} flex items-center justify-center shadow-sm`}>
                                                    <Icon className="w-5 h-5 text-white" />
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 border-none">
                                                    Module
                                                </Badge>
                                            </div>
                                            <CardTitle className="text-lg font-bold text-card-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                                {course.title}
                                            </CardTitle>
                                            <CardDescription className="font-medium text-xs">
                                                {course.level}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-2">
                                                {course.description}
                                            </p>
                                            <div className="flex items-center text-sm font-bold text-primary group-hover:gap-3 gap-2 transition-all">
                                                Go to Assessment
                                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="py-8 border-t border-border bg-card/30">
                <div className="container mx-auto max-w-6xl px-6 text-center">
                    <p className="text-xs text-muted-foreground font-medium tracking-widest">
                        &copy; {new Date().getFullYear()} Proctoring Academy &bull; Secure Environment
                    </p>
                </div>
            </footer>
        </div>
    )
}
