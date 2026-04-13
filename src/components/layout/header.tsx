"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ModeToggle } from "@/components/theme/ModeToggle"
import { cn } from "@/lib/utils"

const NAV = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/services", label: "Services" },
    { href: "/contact", label: "Contact" },
]

const MOBILE_NAV = [...NAV, { href: "/login", label: "Login" }]

export function Header() {
    const pathname = usePathname()
    const [scrolled, setScrolled] = React.useState(false)

    React.useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <header 
            className={cn(
                "fixed top-0 z-50 w-full transition-all duration-300",
                scrolled 
                    ? "bg-background/80 backdrop-blur-3xl border-b-2 border-primary/40 shadow-lg dark:shadow-primary/10" 
                    : "bg-background/40 backdrop-blur-2xl border-b-2 border-primary/20 shadow-none"
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-card shadow-xs transition-all duration-300 group-hover:shadow-md group-hover:border-primary/50 group-hover:scale-105 active:scale-95 overflow-hidden relative">
                         <div className="absolute inset-0 bg-linear-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-lg font-black tracking-tighter relative z-10">V</span>
                    </div>
                    <div className="leading-none flex flex-col pt-0.5">
                        <div className="text-sm font-black tracking-tighter uppercase transition-colors group-hover:text-primary leading-none">VOS-WEB</div>
                        <div className="text-[9px] font-black tracking-[0.2em] text-muted-foreground uppercase opacity-50">Corporate</div>
                    </div>
                </Link>

                <div className="flex-1" />

                {/* Desktop nav */}
                <div className="hidden items-center gap-4 md:flex">
                    <NavigationMenu>
                        <NavigationMenuList className="gap-2">
                            {NAV.map((item) => {
                                const active =
                                    item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)

                                return (
                                    <NavigationMenuItem key={item.href} className="relative">
                                        <NavigationMenuLink asChild>
                                            <Link 
                                                href={item.href} 
                                                className={cn(
                                                    "relative rounded-xl px-4 py-2 text-sm font-black tracking-tight transition-all duration-300",
                                                    "hover:text-primary hover:scale-105 active:scale-95",
                                                    active ? "text-primary" : "text-muted-foreground/70"
                                                )}
                                            >
                                                {item.label}
                                                {active && (
                                                    <motion.div 
                                                        layoutId="nav-active"
                                                        className="absolute inset-0 bg-primary/5 rounded-xl -z-10"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ duration: 0.3 }}
                                                    />
                                                )}
                                            </Link>
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                )
                            })}
                        </NavigationMenuList>
                    </NavigationMenu>

                    <div className="flex items-center gap-2 pl-2">
                        <Button asChild className="rounded-xl cursor-pointer font-black uppercase tracking-widest text-[10px] px-6 shadow-sm hover:shadow-primary/20 active:scale-95 transition-all">
                            <Link href="/login">
                                Login
                                <ChevronRight className="ml-1 h-3 w-3 opacity-70" />
                            </Link>
                        </Button>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <ModeToggle />
                    </div>
                </div>

                {/* Mobile nav */}
                <div className="md:hidden flex items-center gap-2">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-xl cursor-pointer h-10 w-10">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] rounded-l-3xl p-6 border-l-0 shadow-2xl">
                            <SheetHeader className="text-left">
                                <SheetTitle className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border bg-card shadow-xs font-black">V</div>
                                    <span className="font-black tracking-tighter uppercase">VOS-WEB</span>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="mt-8 flex flex-col gap-2">
                                {MOBILE_NAV.map((item, idx) => {
                                    const active =
                                        item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)

                                    return (
                                        <motion.div
                                            key={item.href}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                        >
                                            <Button
                                                asChild
                                                variant={active ? "default" : "ghost"}
                                                className={cn(
                                                    "w-full justify-between rounded-xl h-12 px-4 cursor-pointer font-bold tracking-tight",
                                                    !active && "text-muted-foreground"
                                                )}
                                            >
                                                <Link href={item.href}>
                                                    {item.label}
                                                    {active && <ChevronRight className="h-4 w-4 opacity-50" />}
                                                </Link>
                                            </Button>
                                        </motion.div>
                                    )
                                })}
                            </div>

                            <div className="absolute bottom-10 left-6 right-6">
                                <div className="rounded-2xl bg-accent/50 p-4 border border-border/50">
                                    <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-1">Ecosystem</p>
                                    <p className="text-xs font-bold tracking-tight leading-relaxed">VOS-WEB V2 • Powered by Next.js 15 & Radix UI</p>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <ModeToggle />
                </div>
            </div>
        </header>
    )
}
