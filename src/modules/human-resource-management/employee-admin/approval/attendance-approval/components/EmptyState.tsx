"use client";

import React from "react";
import { LucideIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ 
  icon: Icon = Search, 
  title, 
  description, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-12 text-center h-80 relative overflow-hidden group",
      className
    )}>
      {/* Decorative Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/15 transition-colors duration-500" />
      
      {/* Icon Container */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-[2rem] bg-gradient-to-br from-background/80 to-muted/30 flex items-center justify-center border border-primary/20 shadow-2xl backdrop-blur-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
          <Icon className="h-10 w-10 text-primary animate-pulse group-hover:animate-none" strokeWidth={1.5} />
          
          {/* Sparkles or accent marks */}
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary/40 blur-[2px] animate-ping" />
          <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-primary/30 blur-[1px]" />
        </div>
      </div>
      
      {/* Text Content */}
      <div className="relative space-y-2 max-w-sm">
        <h3 className="text-2xl font-black tracking-tight text-foreground bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">
          {title}
        </h3>
        <p className="text-sm font-semibold text-muted-foreground/80 leading-relaxed px-4">
          {description}
        </p>
      </div>

      {/* Subtle border pattern or texture could go here if needed */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
    </div>
  );
}
