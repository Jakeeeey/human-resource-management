"use client"

import React, { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Observer } from 'gsap/Observer'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'

gsap.registerPlugin(ScrollTrigger, Observer, ScrollToPlugin)

export function HorizontalScrollContainer({ 
    children, 
    onIndexChange,
    activePanel = 0
}: { 
    children: React.ReactNode, 
    onIndexChange?: (index: number) => void,
    activePanel?: number
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollWrapperRef = useRef<HTMLDivElement>(null)
    const currentIndex = useRef(activePanel)
    const isAnimating = useRef(false)

    useLayoutEffect(() => {
        const sections = gsap.utils.toArray('.horizontal-panel') as HTMLElement[]
        const amount = sections.length - 1

        const ctx = gsap.context(() => {
            // Pinning the container
            ScrollTrigger.create({
                trigger: containerRef.current,
                pin: true,
                start: "top top",
                end: () => "+=" + (scrollWrapperRef.current?.offsetWidth || window.innerWidth * 6),
                scrub: false,
            })

            function goToSection(index: number, skipNotify = false) {
                if (index < 0 || index > amount) return
                if (isAnimating.current && index === currentIndex.current) return
                
                isAnimating.current = true
                currentIndex.current = index

                const tl = gsap.timeline({
                    onComplete: () => {
                        isAnimating.current = false
                    }
                })

                // Animate horizontal track
                tl.to(sections, {
                    xPercent: -100 * index,
                    duration: 0.8,
                    ease: "power2.inOut",
                    overwrite: true
                }, 0)

                // Sync vertical scroll
                const vh = window.innerHeight
                const trackWidth = scrollWrapperRef.current?.offsetWidth || window.innerWidth * 6
                const scrollTarget = vh + (index / amount) * (trackWidth - window.innerWidth)
                
                tl.to(window, {
                    scrollTo: { y: scrollTarget, autoKill: false },
                    duration: 0.8,
                    ease: "power2.inOut"
                }, 0)

                if (!skipNotify && onIndexChange) {
                    onIndexChange(index + 1)
                }
            }

            // Sync with external prop change (e.g. sidebar click)
            const normalizedExternalIndex = activePanel > 0 ? activePanel - 1 : 0
            if (activePanel > 0 && normalizedExternalIndex !== currentIndex.current) {
                goToSection(normalizedExternalIndex, true)
            }

            // Observe wheel and touch events to trigger transitions
            const obs = Observer.create({
                target: containerRef.current,
                type: "wheel,touch,pointer",
                onDown: () => !isAnimating.current && currentIndex.current < amount && goToSection(currentIndex.current + 1),
                onUp: () => !isAnimating.current && currentIndex.current > 0 && goToSection(currentIndex.current - 1),
                tolerance: 20,
                preventDefault: false
            })

            return () => obs.kill()
        }, containerRef)

        return () => ctx.revert()
    }, [activePanel, onIndexChange]) // Re-run if activePanel changes from outside

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
