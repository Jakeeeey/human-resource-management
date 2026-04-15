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

    const accentConfigs = {
        cyan: {
            glow: "from-cyan-500/5 dark:from-cyan-500/10",
            border: "group-hover:border-cyan-500/30",
            shadow: "group-hover:shadow-cyan-500/10"
        },
        indigo: {
            glow: "from-indigo-500/5 dark:from-indigo-500/10",
            border: "group-hover:border-indigo-500/30",
            shadow: "group-hover:shadow-indigo-500/10"
        },
        rose: {
            glow: "from-rose-500/5 dark:from-rose-500/10",
            border: "group-hover:border-rose-500/30",
            shadow: "group-hover:shadow-rose-500/10"
        },
        emerald: {
            glow: "from-emerald-500/5 dark:from-emerald-500/10",
            border: "group-hover:border-emerald-500/30",
            shadow: "group-hover:shadow-emerald-500/10"
        },
        amber: {
            glow: "from-amber-500/5 dark:from-amber-500/10",
            border: "group-hover:border-amber-500/30",
            shadow: "group-hover:shadow-amber-500/10"
        },
        violet: {
            glow: "from-violet-500/5 dark:from-violet-500/10",
            border: "group-hover:border-violet-500/30",
            shadow: "group-hover:shadow-violet-500/10"
        },
    }

    const config = accentConfigs[accent]

    return (
        <motion.div 
            initial={initial}
            whileInView={whileInView}
            viewport={viewport}
            transition={transition}
            className={cn(
                "relative group overflow-hidden rounded-[2rem] border bg-white/40 border-slate-900/5 dark:bg-slate-950/40 dark:border-white/5 backdrop-blur-3xl transition-all duration-700",
                "shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]",
                "hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] dark:hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.9)]",
                "hover:bg-white/60 dark:hover:bg-slate-900/60",
                config.border,
                className
            )}
            {...props}
        >
            {/* Inner Volumetric Lighting */}
            <div className="absolute inset-0 pointer-events-none rounded-[2rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] z-20" />
            
            {/* Ambient Base Glow */}
            <div className={cn(
                "absolute -inset-px bg-linear-to-br opacity-20 dark:opacity-30 blur-2xl transition-opacity duration-700 pointer-events-none group-hover:opacity-40",
                config.glow,
                "to-transparent"
            )} />

            {/* Accent Highlight (Top Corner) */}
            <div className={cn(
                "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[64px] opacity-0 transition-opacity duration-1000 group-hover:opacity-20",
                accent === "cyan" ? "bg-cyan-500" :
                accent === "indigo" ? "bg-indigo-500" :
                accent === "rose" ? "bg-rose-500" :
                accent === "emerald" ? "bg-emerald-500" :
                accent === "amber" ? "bg-amber-500" : "bg-violet-500"
            )} />

            <div className="relative z-10 h-full">
                {children}
            </div>
        </motion.div>
    )
}
