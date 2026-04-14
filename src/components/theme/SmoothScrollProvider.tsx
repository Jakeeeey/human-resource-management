"use client";

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

declare global {
    interface Window {
        lenis: Lenis | undefined;
    }
}

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        })

        window.lenis = lenis;
        lenis.on('scroll', ScrollTrigger.update)

        const raf = (time: number) => {
            lenis.raf(time * 1000)
        }

        gsap.ticker.add(raf)
        gsap.ticker.lagSmoothing(0)

        // Removing the native requestAnimationFrame and letting GSAP Ticker drive lenis
        // This stops Lenis from fighting GSAP's scroll and maintains animation sync

        return () => {
            gsap.ticker.remove(raf)
            lenis.destroy()
            window.lenis = null;
        }
    }, [])

    return <>{children}</>
}
