"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, User, GraduationCap, Loader2, AlertCircle, Shield } from "lucide-react"

export default function LoginPage() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            })

            if (res.ok) {
                const data = await res.json()
                localStorage.setItem("user", JSON.stringify({
                    userId: data.userId,
                    username: username
                }))
                router.push("/dashboard")
            } else {
                const data = await res.json()
                setError(data.message || "Login failed")
            }
        } catch (err) {
            console.error(err)
            setError("An error occurred. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background font-sans relative overflow-hidden">
            {/* Ambient background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-primary/5" />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

            <div className="relative z-10 w-full max-w-[420px] px-4">
                {/* Brand Header */}
                <div className="text-center mb-8 space-y-3">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                        <GraduationCap className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Proctoring Academy</h1>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
                            <Shield className="w-3 h-3" />
                            Secure Learning Platform
                        </p>
                    </div>
                </div>

                <Card className="border border-border/50 shadow-2xl bg-card/90 backdrop-blur-md overflow-hidden">
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                    <CardHeader className="space-y-1 pb-4 pt-8">
                        <CardTitle className="text-xl font-bold tracking-tight text-center">
                            Welcome back
                        </CardTitle>
                        <CardDescription className="text-center">
                            Enter your credentials to access your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        type="text"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        className="pl-10 h-11 bg-background border-input focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="pl-10 h-11 bg-background border-input focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
                                    />
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive" className="py-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-11 font-semibold shadow-sm"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Signing in...
                                    </span>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col items-center gap-3 pt-2 pb-6 px-6">
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                            Proctoring Academy &copy; {new Date().getFullYear()}
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
