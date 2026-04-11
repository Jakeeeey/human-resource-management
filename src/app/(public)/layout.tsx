"use client"

import * as React from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <div className="min-h-dvh flex flex-col bg-background text-foreground overflow-x-hidden">
            <Header />
            <AnimatePresence mode="wait">
                <motion.main 
                    key={pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex-1"
                >
                    {children}
                </motion.main>
            </AnimatePresence>
            <Footer />
        </div>
    )
}
