"use client"

import React, { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function HorizontalScrollContainer({ children }: { children: React.ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollWrapperRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const sections = gsap.utils.toArray('.horizontal-panel') as HTMLElement[]
            
            gsap.to(sections, {
                xPercent: -100 * (sections.length - 1),
                ease: "none",
                scrollTrigger: {
                    trigger: containerRef.current,
                    pin: true,
                    scrub: 1,
                    snap: 1 / (sections.length - 1),
                    end: () => "+=" + scrollWrapperRef.current?.offsetWidth
                }
            })
        }, containerRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={containerRef} className="relative w-full h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Background Blur Orbs */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[150px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 blur-[150px] pointer-events-none" />
            
            {/* Scrolling Track */}
            <div ref={scrollWrapperRef} className="flex h-full w-[600vw]">
                {children}
            </div>
        </section>
    )
}

export function HorizontalPanel({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`horizontal-panel relative w-screen h-screen flex items-center justify-center shrink-0 ${className || ''}`}>
            {children}
        </div>
    )
}
