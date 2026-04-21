"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface RequestTypeCardProps {
  type: "leave" | "overtime" | "undertime";
  icon: LucideIcon;
  label: string;
  description: string;
  pendingCount: number;
  isLoading?: boolean;
  onClick: () => void;
}

const TYPE_STYLES = {
  leave: {
    container: "bg-blue-900 border-transparent hover:shadow-[0_8px_30px_rgb(29,78,216,0.25)] shadow-xl",
    gradient: "from-blue-700 to-blue-950",
    iconBg: "bg-white/10 text-white",
    badge: "bg-white/10 border-white/20 text-white",
    dot: "bg-blue-300",
  },
  overtime: {
    container: "bg-purple-900 border-transparent hover:shadow-[0_8px_30px_rgb(109,40,217,0.25)] shadow-xl",
    gradient: "from-violet-700 to-purple-950",
    iconBg: "bg-white/10 text-white",
    badge: "bg-white/10 border-white/20 text-white",
    dot: "bg-violet-300",
  },
  undertime: {
    container: "bg-orange-900 border-transparent hover:shadow-[0_8px_30px_rgb(194,65,12,0.25)] shadow-xl",
    gradient: "from-orange-600 to-orange-950",
    iconBg: "bg-white/10 text-white",
    badge: "bg-white/10 border-white/20 text-white",
    dot: "bg-orange-300",
  },
};

export function RequestTypeCard({
  type,
  icon: Icon,
  label,
  description,
  pendingCount,
  isLoading,
  onClick,
}: RequestTypeCardProps) {
  const styles = TYPE_STYLES[type];

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "group relative w-full text-left rounded-3xl overflow-hidden transition-all duration-300",
        "border shadow-sm hover:shadow-md cursor-pointer",
        styles.container
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", styles.gradient)} />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className={cn("p-2.5 rounded-2xl", styles.iconBg)}>
            <Icon className="h-6 w-6" strokeWidth={2} />
          </div>

          {/* Pending badge */}
          {pendingCount > 0 && (
            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider animate-in fade-in zoom-in duration-300", styles.badge)}>
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", styles.dot)} />
              {pendingCount} Pending
            </div>
          )}
          {pendingCount === 0 && !isLoading && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white/5 border-white/10 text-[10px] font-bold text-white/50 uppercase tracking-wider">
              All Clear
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-1 my-6">
          <h3 className="text-xl font-black tracking-tight text-white">{label}</h3>
          <p className="text-xs text-white/70 font-medium">{description}</p>
        </div>

        {/* Stats row & CTA */}
        <div className="flex items-end justify-between border-t border-white/20 pt-5 mt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white leading-none tabular-nums">
                {isLoading ? <span className="inline-block w-6 h-6 rounded-md bg-white/20 animate-pulse" /> : pendingCount}
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest leading-tight">Requests</span>
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest leading-tight">Pending</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-white/70 group-hover:text-white transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">
              {pendingCount > 0 ? "Review" : "History"}
            </span>
            <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}
