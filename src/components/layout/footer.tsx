import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Github, Twitter, Linkedin, Mail, Globe } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t bg-muted/10 pt-16 pb-8">
            <div className="mx-auto max-w-6xl px-4">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
                    {/* Brand Section */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-card shadow-xs font-black tracking-tighter uppercase">V</div>
                            <div className="text-xl font-black tracking-tighter uppercase text-primary">VOS-WEB</div>
                        </div>
                        <p className="max-w-sm text-sm font-medium text-muted-foreground leading-relaxed">
                            A high-density, mission-critical ERP ecosystem designed for precision and scale. Built with modern web standards and premium aesthetics for VOS Web V2.
                        </p>
                        <div className="flex gap-4">
                            <Button size="icon" variant="ghost" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all active:scale-90 cursor-pointer">
                                <Github className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all active:scale-90 cursor-pointer">
                                <Twitter className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all active:scale-90 cursor-pointer">
                                <Linkedin className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Links - Quick Access */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-black tracking-widest uppercase text-muted-foreground/60">Platform</h4>
                        <ul className="flex flex-col gap-3">
                            <li><Link href="/" className="text-sm font-bold tracking-tight text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">Home</Link></li>
                            <li><Link href="/about" className="text-sm font-bold tracking-tight text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">About Us</Link></li>
                            <li><Link href="/services" className="text-sm font-bold tracking-tight text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">Services</Link></li>
                            <li><Link href="/contact" className="text-sm font-bold tracking-tight text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">Contact</Link></li>
                        </ul>
                    </div>

                    {/* Links - Legal/Contact */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-black tracking-widest uppercase text-muted-foreground/60">Contact</h4>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-muted-foreground transition-colors hover:text-primary group">
                                <Mail className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                                <span>hello@vosweb.co</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-muted-foreground transition-colors hover:text-primary group">
                                <Globe className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                                <span>vos-web-v2.systems</span>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="my-12 opacity-50" />

                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs font-bold tracking-tight text-muted-foreground/50 uppercase">
                        © {new Date().getFullYear()} VOS-WEB ERP. All rights reserved.
                    </div>
                    <div className="flex items-center gap-6">
                         <Link href="#" className="text-xs font-bold tracking-tight text-muted-foreground/50 hover:text-primary transition-colors uppercase">Privacy</Link>
                         <Link href="#" className="text-xs font-bold tracking-tight text-muted-foreground/50 hover:text-primary transition-colors uppercase">Terms</Link>
                        <div className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground/30 flex items-center gap-2 select-none">
                             SHADCN • RADIX • NEXT.JS 15
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
