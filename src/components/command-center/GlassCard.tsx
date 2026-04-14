"use client"

import * as React from "react"
import { HTMLMotionProps, motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode
    accent?: "cyan" | "indigo" | "rose" | "emerald" | "amber" | "violet"
}

export function GlassCard({ 
    children, 
    className, 
    accent = "cyan", 
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
