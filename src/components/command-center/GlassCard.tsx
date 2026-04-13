"use client"

import * as React from "react"
import { HTMLMotionProps, motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode
    accent?: "cyan" | "indigo" | "rose" | "emerald" | "amber" | "violet"
    pulse?: boolean
}

export function GlassCard({ 
    children, 
    className, 
    accent = "cyan", 
    pulse = false,
    initial = { opacity: 0, y: 30 },
    whileInView = { opacity: 1, y: 0 },
    viewport = { once: true, margin: "-20px" },
    transition = { duration: 0.5, ease: "easeOut" },
    ...props 
}: GlassCardProps) {


    const accentColor = {
        cyan: "from-cyan-500/10 dark:from-cyan-500/10",
        indigo: "from-indigo-600/10 dark:from-indigo-500/10",
        rose: "from-rose-600/10 dark:from-rose-500/10",
        emerald: "from-emerald-600/10 dark:from-emerald-500/10",
        amber: "from-amber-600/10 dark:from-amber-500/10",
        violet: "from-violet-600/10 dark:from-violet-500/10",
    }[accent]

    const borderColor = {
        cyan: "border-cyan-500/10 dark:border-cyan-500/20 shadow-[0_0_15px_-5px_rgba(6,182,212,0.1)]",
        indigo: "border-indigo-500/10 dark:border-indigo-500/20 shadow-[0_0_15px_-5px_rgba(79,70,229,0.1)]",
        rose: "border-rose-500/10 dark:border-rose-500/20 shadow-[0_0_15px_-5px_rgba(225,29,72,0.1)]",
        emerald: "border-emerald-500/10 dark:border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(5,150,105,0.1)]",
        amber: "border-amber-500/10 dark:border-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.1)]",
        violet: "border-violet-500/10 dark:border-violet-500/20 shadow-[0_0_15px_-5px_rgba(139,92,246,0.1)]",
    }[accent]

    return (
        <motion.div 
            initial={initial}
            whileInView={whileInView}
            viewport={viewport}
            transition={transition}
            className={cn(
                "relative group overflow-hidden rounded-2xl border bg-white/40 border-slate-900/5 hover:border-slate-900/10 dark:bg-white/[0.02] dark:border-white/5 hover:dark:border-white/20 backdrop-blur-2xl transition-all duration-500 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]",
                className
            )}
            {...props}
        >
            {/* Background Glow */}
            <div className={cn(
                "absolute -inset-px bg-linear-to-br opacity-0 transition-opacity duration-500 pointer-events-none group-hover:opacity-100",
                accentColor,
                "to-transparent"
            )} />



            <div className="relative z-10 h-full">
                {children}
            </div>
            

        </motion.div>
    )
}
