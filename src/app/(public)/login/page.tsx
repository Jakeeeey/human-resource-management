// src/app/login/page.tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

function normalizeLoginErrorMessage(rawMsg: string, httpStatus?: number) {
    const msg = String(rawMsg || "")
    const m = msg.toLowerCase()

    // ✅ Invalid credentials (401)
    if (
        httpStatus === 401 ||
        m.includes("http 401") ||
        m.includes("unauthorized") ||
        m.includes("invalid credentials")
    ) {
        return "Credentials invalid."
    }

    // ✅ Backend unreachable / connection problems -> friendly message
    if (
        m.includes("cannot reach spring api") ||
        m.includes("econnrefused") ||
        m.includes("fetch failed") ||
        m.includes("network error") ||
        m.includes("timeout") ||
        m.includes("aborted")
    ) {
        return "Server is down, please contact Administrator."
    }

    return msg
}

type FieldErrors = {
    email?: string
    hashPassword?: string
}

export default function LoginPage() {
    return (
        <React.Suspense fallback={<div className="min-h-dvh flex items-center justify-center font-black tracking-widest text-xs uppercase animate-pulse">Initializing Portal...</div>}>
            <LoginForm />
        </React.Suspense>
    )
}

function LoginForm() {
    const searchParams = useSearchParams()

    const [showPw, setShowPw] = React.useState(false)
    const [loading, setLoading] = React.useState(false)

    const [email, setEmail] = React.useState("")
    const [hashPassword, setHashPassword] = React.useState("")
    const [remember, setRemember] = React.useState(false)

    const [errors, setErrors] = React.useState<FieldErrors>({})

    const validate = React.useCallback((): boolean => {
        const next: FieldErrors = {}

        if (!String(email).trim()) next.email = "Email is required"
        if (!String(hashPassword).trim()) next.hashPassword = "Password is required"

        setErrors(next)
        return Object.keys(next).length === 0
    }, [email, hashPassword])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validate()) return

        setLoading(true)

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, hashPassword, remember }),
            })

            const data = await res.json().catch(() => null)

            if (!res.ok || !data?.ok) {
                const raw = String(data?.message ?? `Login failed (HTTP ${res.status}).`)
                const msg = normalizeLoginErrorMessage(raw, res.status)
                toast.error("Sign in failed", { description: msg })
                return
            }

            toast.success("Signed in", { description: "Welcome back." })

            let next = searchParams.get("next") || "/main-dashboard"
            if (!next.startsWith("/")) next = "/main-dashboard"

            window.location.href = next
        } catch (err: unknown) {
            const errorInfo = err as { message?: string };
            const raw = errorInfo?.message ? String(errorInfo.message) : "Network error. Please try again."
            const msg = normalizeLoginErrorMessage(raw)
            toast.error("Sign in failed", { description: msg })
        } finally {
            setLoading(false)
        }
    }

    const emailHasError = Boolean(errors.email)
    const pwHasError = Boolean(errors.hashPassword)

    return (
        <div className="relative min-h-[calc(100dvh-64px)] overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/2 rounded-full blur-3xl -z-10 animate-pulse" />

            <div className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-6xl items-center justify-center px-4 py-12">
                <div className="grid w-full gap-8 lg:grid-cols-2 lg:gap-16">
                    {/* Left: Brand / intro */}
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="hidden flex-col justify-between rounded-[2rem] border bg-card/40 backdrop-blur-md p-12 lg:flex relative overflow-hidden group shadow-2xl border-white/5"
                    >
                        <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-background shadow-xs font-black text-xl tracking-tighter">V</div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-black tracking-tighter uppercase leading-none">VOS ERP</span>
                                    <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase mt-1">v2.systems</span>
                                </div>
                            </div>

                            <div className="mt-16 space-y-6">
                                <h1 className="text-5xl font-black tracking-tighter leading-[0.95] uppercase decoration-primary/20 underline-offset-8">
                                    Simplified <br />
                                    Business <br />
                                    <span className="text-primary italic">Management.</span>
                                </h1>
                                <p className="max-w-sm text-base font-bold text-muted-foreground/80 leading-relaxed tracking-tight">
                                    Manage your organization&apos;s resources efficiently with our easy-to-use ERP system.
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 space-y-10">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                 {['Supply Chain', 'Finance', 'Human Resources', 'Analytics'].map((feat) => (
                                     <div key={feat} className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-muted-foreground transition-colors hover:text-primary">
                                          <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                                          {feat}
                                     </div>
                                 ))}
                            </div>
                            
                            <div className="flex items-center gap-5 p-6 rounded-3xl bg-primary/5 border border-primary/10 backdrop-blur-sm group/security">
                                <div className="p-3 rounded-2xl bg-background border border-primary/20 shadow-xs transition-transform group-hover/security:scale-110">
                                    <ShieldCheck className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                                        Secure Login Protected
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 rounded-sm border-primary/30 text-primary font-black uppercase">Active</Badge>
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-bold tracking-tight">Your data is encrypted and saved securely for your protection.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right: Form */}
                    <motion.div 
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                        className="flex items-center justify-center"
                    >
                        <Card className="w-full max-w-md border-0 shadow-2xl rounded-[2rem] bg-card/80 backdrop-blur-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-primary/50 via-primary to-primary/50" />
                            
                            <CardHeader className="space-y-1 pt-12 px-8">
                                <CardTitle className="text-4xl font-black tracking-tighter uppercase">Sign in</CardTitle>
                                <CardDescription className="font-bold tracking-tight text-muted-foreground/60 uppercase text-[10px] flex items-center gap-2">
                                    Please enter your details below <ArrowRight className="h-3 w-3" />
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="px-8 pb-12">
                                <form onSubmit={onSubmit} className="space-y-6">
                                    {/* Email */}
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email Address</Label>
                                        <div className="relative group/field">
                                            <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within/field:text-primary" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="name@company.com"
                                                className={cn(
                                                    "h-12 pl-11 rounded-xl bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all font-bold tracking-tight",
                                                    emailHasError && "bg-destructive/5 ring-1 ring-destructive"
                                                )}
                                                autoComplete="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value)
                                                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
                                                }}
                                                disabled={loading}
                                                aria-invalid={emailHasError}
                                            />
                                        </div>
                                        {emailHasError && (
                                            <p className="text-[10px] font-black uppercase tracking-tight text-destructive animate-in fade-in slide-in-from-top-1">
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password" title="password" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Password</Label>
                                            <Button variant="link" type="button" className="h-auto p-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors" disabled>
                                                Forgot Password?
                                            </Button>
                                        </div>
                                        <div className="relative group/field">
                                            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within/field:text-primary" />
                                            <Input
                                                id="password"
                                                type={showPw ? "text" : "password"}
                                                placeholder="••••••••"
                                                className={cn(
                                                    "h-12 pl-11 pr-12 rounded-xl bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all font-bold tracking-tight",
                                                    pwHasError && "bg-destructive/5 ring-1 ring-destructive"
                                                )}
                                                autoComplete="current-password"
                                                value={hashPassword}
                                                onChange={(e) => {
                                                    setHashPassword(e.target.value)
                                                    if (errors.hashPassword)
                                                        setErrors((p) => ({ ...p, hashPassword: undefined }))
                                                }}
                                                disabled={loading}
                                                aria-invalid={pwHasError}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPw((s) => !s)}
                                                className={cn(
                                                    "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg",
                                                    "text-muted-foreground hover:bg-background hover:text-primary transition-all active:scale-90"
                                                )}
                                                aria-label={showPw ? "Hide password" : "Show password"}
                                                disabled={loading}
                                            >
                                                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {pwHasError && (
                                            <p className="text-[10px] font-black uppercase tracking-tight text-destructive animate-in fade-in slide-in-from-top-1">
                                                {errors.hashPassword}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 py-2">
                                        <Checkbox
                                            id="remember"
                                            checked={remember}
                                            onCheckedChange={(v) => setRemember(Boolean(v))}
                                            disabled={loading}
                                            className="rounded-md h-5 w-5 border-muted-foreground/20 data-[state=checked]:bg-primary transition-colors"
                                        />
                                        <label htmlFor="remember" className="text-xs font-bold tracking-tight text-muted-foreground/80 cursor-pointer select-none">
                                            Remember me
                                        </label>
                                    </div>

                                    <Button 
                                        type="submit" 
                                        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all" 
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-3">
                                                <div className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                                                Signing in...
                                            </div>
                                        ) : (
                                            "Sign In"
                                        )}
                                    </Button>

                                    <div className="pt-4 space-y-4">
                                        <p className="text-center text-[9px] font-bold text-muted-foreground/40 leading-relaxed uppercase tracking-widest mx-auto max-w-[200px]">
                                            By signing in, you agree to our internal safety policies.
                                        </p>
                                        
                                        <Separator className="opacity-30" />

                                        <div className="text-center">
                                            <Link 
                                                className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 hover:text-primary transition-colors" 
                                                href="/public"
                                            >
                                                [ Back to Home ]
                                            </Link>
                                        </div>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
