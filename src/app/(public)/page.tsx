"use client"

import * as React from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import Image from "next/image"
import {
    Shield,
    BarChart3,
    Settings,
    Users,
    Database,
    Globe,
    Cpu,
    LayoutDashboard
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { MissionStatsGrid } from "@/components/command-center/MissionStatsGrid"
import { GlassCard } from "@/components/command-center/GlassCard"
import { cn } from "@/lib/utils"

import { HorizontalScrollContainer, HorizontalPanel } from "@/components/command-center/HorizontalScrollContainer"

// Specialized Visualizers
import { WorkforcePulse } from "@/components/command-center/visualizers/WorkforcePulse"
import { LiquidityMeter } from "@/components/command-center/visualizers/LiquidityMeter"
import { AssetLifecycle } from "@/components/command-center/visualizers/AssetLifecycle"
import { InventoryTreadmill } from "@/components/command-center/visualizers/InventoryTreadmill"
import { ReceivablesAging } from "@/components/command-center/visualizers/ReceivablesAging"
// import { RiskRadar } from "@/components/command-center/visualizers/RiskRadar"
import { MatrixAuditLog } from "@/components/command-center/visualizers/MatrixAuditLog"

// Previous Visualizers (Now repurposed)
import { ConnectionNode } from "@/components/command-center/ConnectionNode"
import { AnalyticsWorkbench } from "@/components/command-center/AnalyticsWorkbench"
import { GlobalHealthViz } from "@/components/command-center/GlobalHealthViz"

// Interactive Modal
import { ModuleDetailModal, type ModuleDetailModalProps } from "@/components/command-center/ModuleDetailModal"

export default function LandingPage() {
    const { scrollY } = useScroll()

    // Modal State
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    interface ModuleData {
        description: string;
        stats: { label: string; value: string; trend?: string }[];
    }

    const [activeModule, setActiveModule] = React.useState<{
        name: string;
        accent: "cyan" | "indigo" | "rose" | "emerald" | "amber" | "violet";
        data: ModuleData;
    } | null>(null)

    const openModule = (name: string, accent: ModuleDetailModalProps["accent"], data: ModuleData) => {
        setActiveModule({ name, accent, data })
        setIsModalOpen(true)
    }

    const [activePanel, setActivePanel] = React.useState(0)

    // Sidebar Navigation Logic
    const scrollToPanel = (index: number) => {
        if (index === 0) {
            setActivePanel(0);
            if ((window as any).lenis) {
                (window as any).lenis.scrollTo(0, { duration: 1.2 });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            // Set the state, and the HorizontalScrollContainer will detect the prop change
            // and trigger its internal goToSection() which has the mathematically exact ScrollTrigger targets.
            setActivePanel(index);
        }
    }

    // Update active panel based on scroll (Hero to Horizontal transition)
    React.useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            const vh = window.innerHeight;

            // Only handle the "Hero vs Content" logic here.
            // Content panels (1-6) are handled by HorizontalScrollContainer callback.
            if (y < vh * 0.5) {
                setActivePanel(0);
            } else if (activePanel === 0 && y >= vh * 0.5) {
                setActivePanel(1);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [activePanel]);

    // Hero Scroll Parallax
    const opacity = useTransform(scrollY, [0, 400], [1, 0])
    const scale = useTransform(scrollY, [0, 400], [1, 0.9])
    const y = useTransform(scrollY, [0, 400], [0, 100])
    const bgY = useTransform(scrollY, [0, 1000], [0, 300])

    const MODULE_DATA = {
        HRM: {
            description: "Real-time workforce activity and shift dynamics. Monitoring attendance velocity and core department load.",
            stats: [
                { label: "Total Headcount", value: "2,840", trend: "+12%" },
                { label: "Active Shift", value: "842 Personnel", trend: "NOMINAL" },
                { label: "Punctuality Rate", value: "94.2%", trend: "STABLE" }
            ]
        },
        FIN: {
            description: "Fiscal orchestration and asset monitoring. High-precision cashflow management and ledger auditing.",
            stats: [
                { label: "Available Liquidity", value: "₱4.24M", trend: "OPTIMAL" },
                { label: "Daily Burn Velocity", value: "-₱14.2K", trend: "-2%" },
                { label: "Fixed Assets", value: "842 Nodes" }
            ]
        },
        SCM: {
            description: "Inventory and logistics orchestration layer. End-to-end supply chain visibility and fleet dispatch telemetry.",
            stats: [
                { label: "Inventory Accuracy", value: "97.4%", trend: "+1.2%" },
                { label: "Fleet Active", value: "14/15", trend: "+1" },
                { label: "Turnover Rate", value: "14.2X" }
            ]
        },
        CRM: {
            description: "Revenue pipeline and client hub. Real-time billing cycles and accounts receivable lifecycle management.",
            stats: [
                { label: "Active Clients", value: "3,204", trend: "+84" },
                { label: "Invoice Conversion", value: "94.2%", trend: "HIGH" },
                { label: "Recycled Orders", value: "12%" }
            ]
        },
        BI: {
            description: "The system brain. Analyzing cross-domain trends for strategic decision making and risk mitigation.",
            stats: [
                { label: "System Integrity", value: "94.8%", trend: "SECURE" },
                { label: "Data Throughput", value: "1.2TB", trend: "NOMINAL" },
                { label: "Risk Mitigation", value: "FAST" }
            ]
        },
        ARF: {
            description: "Assurance and transparency layer. Monitoring every system-wide audit action for non-repudiable logging.",
            stats: [
                { label: "Compliance Health", value: "99.8%", trend: "+0.3%" },
                { label: "Open Findings", value: "3 Minor", trend: "LOW" },
                { label: "Audit Gap Velocity", value: "0.1s" }
            ]
        }
    }

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-cyan-500/30 overflow-hidden">

            <ModuleDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                moduleName={activeModule?.name || ""}
                accent={activeModule?.accent || "cyan"}
                data={activeModule?.data || { description: "", stats: [] }}
            />

            {/* Sidebar Subsystem Switcher (Quick Nav) */}
            <div className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-4">
                {[
                    { icon: LayoutDashboard, label: "HERO", color: "text-cyan-500" },
                    { icon: Cpu, label: "HRM", color: "text-cyan-500" },
                    { icon: Database, label: "FIN", color: "text-emerald-500" },
                    { icon: Globe, label: "SCM", color: "text-amber-500" },
                    { icon: Users, label: "CRM", color: "text-indigo-500" },
                    { icon: BarChart3, label: "BI", color: "text-violet-500" },
                    { icon: Shield, label: "ARF", color: "text-rose-500" },
                ].map((item, i) => (
                    <motion.button
                        key={item.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 + i * 0.1 }}
                        onClick={() => scrollToPanel(i)}
                        className="group relative flex items-center gap-4"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl flex items-center justify-center transition-all",
                            activePanel === i ? "border-cyan-500 bg-cyan-500/10" : "",
                            i === 0 ? "hover:border-cyan-500/50" :
                                i === 1 ? "hover:border-cyan-500/50" :
                                    i === 2 ? "hover:border-emerald-500/50" :
                                        i === 3 ? "hover:border-amber-500/50" :
                                            i === 4 ? "hover:border-indigo-500/50" :
                                                i === 5 ? "hover:border-violet-500/50" : "hover:border-rose-500/50"
                        )}>
                            <item.icon className={cn("w-5 h-5 text-slate-500 dark:text-white/40 transition-colors", `group-hover:${item.color}`)} />
                        </div>
                        <span className={cn("absolute left-14 text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity tracking-widest", item.color)}>
                            {item.label}
                        </span>
                    </motion.button>
                ))}
            </div>

            {/* 1. HERO UNIT */}
            <section id="hero" className="relative h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
                <motion.div style={{ y: bgY }} className="absolute inset-0 z-0 block dark:hidden">
                    <Image src="/images/hero_dashboard_light.png" alt="Backdrop" fill priority className="object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-50/40 via-transparent to-slate-50" />
                </motion.div>
                <motion.div style={{ y: bgY }} className="absolute inset-0 z-0 hidden dark:block opacity-30 grayscale-[0.5] contrast-125">
                    <Image src="/images/hero_dashboard.png" alt="Backdrop" fill priority className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/20 to-slate-950" />
                </motion.div>

                <motion.div
                    style={{ opacity, scale, y }}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="container mx-auto px-6 relative z-10 text-center will-change-transform will-change-opacity pt-20"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1 }}
                        className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-10 backdrop-blur-xl"
                    >
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        VOS-WEB-V2 // Next-Gen ERP Command Center
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="text-6xl md:text-[7rem] font-black tracking-tighter mb-6 leading-[0.85] uppercase italic text-slate-900 dark:text-white"
                    >
                        VOS-WEB: <br />
                        <span className="text-transparent bg-clip-text bg-linear-to-b from-cyan-300 to-cyan-600">ERP CONTROL</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="text-lg md:text-2xl text-slate-600 dark:text-white/50 mb-16 max-w-3xl mx-auto leading-relaxed font-medium"
                    >
                        Six integrated subsystems. One unified command surface. <br />
                        HRM · Finance · SCM · CRM · BI · Audit — all in real time.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="max-w-6xl mx-auto"
                    >
                        <MissionStatsGrid />
                    </motion.div>
                </motion.div>
            </section>

            {/* GSAP HORIZONTAL SCROLL TRIGGER */}
            <HorizontalScrollContainer activePanel={activePanel} onIndexChange={setActivePanel}>
                {/* 2. HRM — Human Resource Management (CYAN) */}
                <HorizontalPanel className="px-6 md:px-12 lg:px-24 overflow-hidden">
                    {/* Background Aura */}
                    <div className="absolute inset-0 z-0">
                        <motion.img 
                            initial={{ scale: 1.2, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 0.15 }}
                            transition={{ duration: 2 }}
                            src="/hrm_tech_bg_1776080411521.png" 
                            className="w-full h-full object-cover blur-[120px]"
                        />
                    </div>
                    {/* Watermark */}
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 -rotate-90 select-none pointer-events-none opacity-5 dark:opacity-10 z-0">
                        <span className="text-[15rem] font-black uppercase tracking-tighter whitespace-nowrap italic leading-none text-cyan-500">HUMAN_RESOURCE</span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10"
                    >
                        <div className="lg:col-span-7 order-2 lg:order-1">
                            <GlassCard className="p-8 cursor-pointer relative z-10" accent="cyan" onClick={() => openModule("HRM", "cyan", MODULE_DATA.HRM)}>
                                <WorkforcePulse />
                            </GlassCard>
                        </div>
                        <div className="lg:col-span-5 space-y-8 order-1 lg:order-2 text-right">
                            <div className="space-y-4">
                                <h2 className="text-5xl md:text-[5rem] font-black uppercase tracking-tighter italic leading-[0.9] text-slate-900 dark:text-white">
                                    Human <br /><span className="text-cyan-500">Resource</span>
                                </h2>
                                <p className="text-lg font-medium text-slate-600 dark:text-white/40 leading-relaxed max-w-md ml-auto">
                                    Personnel and workforce data HQ, managing employee lifecycle and attendance tracking with RBAC compliance.
                                </p>
                            </div>
                            <Button
                                onClick={() => openModule("HRM", "cyan", MODULE_DATA.HRM)}
                                className="rounded-full bg-cyan-500/10 border border-cyan-500/50 text-cyan-700 dark:text-cyan-400 font-black uppercase tracking-widest text-[10px] px-10 h-12 hover:bg-cyan-500 hover:text-white transition-all shadow-[0_0_30px_rgba(6,182,212,0.1)]"
                            >
                                Open Telemetry
                            </Button>
                        </div>
                    </motion.div>
                </HorizontalPanel>

                {/* 3. FINANCIAL MANAGEMENT (EMERALD) */}
                <HorizontalPanel className="px-6 md:px-12 lg:px-24 overflow-hidden">
                    {/* Background Aura */}
                    <div className="absolute inset-0 z-0">
                        <motion.img 
                            initial={{ scale: 1.1, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 0.12 }}
                            transition={{ duration: 2.5 }}
                            src="/finance_tech_bg_1776080430564.png" 
                            className="w-full h-full object-cover blur-[100px]"
                        />
                    </div>
                    {/* Watermark */}
                    <div className="absolute bottom-10 right-10 select-none pointer-events-none opacity-5 dark:opacity-10 z-0 text-right">
                        <span className="text-[12rem] font-black uppercase tracking-tighter italic leading-none text-emerald-500">FISCAL_CORE</span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="w-full max-w-7xl mx-auto space-y-16 relative z-10"
                    >
                        <div className="flex flex-col md:flex-row items-end justify-between gap-8 border-b border-emerald-500/10 pb-12">
                            <h2 className="text-5xl md:text-[5.5rem] font-black uppercase tracking-tighter italic leading-[0.8] text-slate-900 dark:text-white">
                                Financial <br /><span className="text-emerald-500 text-[6.5rem]">MANAGEMENT</span>
                            </h2>
                            <p className="max-w-md text-slate-600 dark:text-white/40 text-xl font-medium italic leading-relaxed text-right">
                                High-precision fiscal tracking. Monitor Treasury, General Ledger, and Fixed Assets in real-time.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                            <div className="lg:col-span-5">
                                <GlassCard className="p-8 cursor-pointer relative z-10 h-full" accent="emerald" onClick={() => openModule("FIN", "emerald", MODULE_DATA.FIN)}>
                                    <LiquidityMeter />
                                </GlassCard>
                            </div>
                            <div className="lg:col-span-7">
                                <GlassCard className="p-8 cursor-pointer relative z-10 h-full" accent="emerald" onClick={() => openModule("FIN", "emerald", MODULE_DATA.FIN)}>
                                    <AssetLifecycle />
                                </GlassCard>
                            </div>
                        </div>
                    </motion.div>
                </HorizontalPanel>

                {/* 4. SUPPLY CHAIN MANAGEMENT (AMBER) */}
                <HorizontalPanel className="px-6 md:px-12 lg:px-24 overflow-hidden bg-slate-100/50 dark:bg-slate-900/10">
                    {/* Background Map Wash */}
                    <div className="absolute inset-x-0 bottom-0 top-1/4 z-0">
                        <motion.img 
                            initial={{ y: 100, opacity: 0 }}
                            whileInView={{ y: 0, opacity: 0.2 }}
                            transition={{ duration: 2 }}
                            src="/scm_tech_bg_v2_1776080502518.png" 
                            className="w-full h-full object-cover blur-[80px]"
                        />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 relative z-10"
                    >
                        <div className="space-y-12">
                            <div className="space-y-6">
                                <h2 className="text-5xl md:text-[5rem] font-black uppercase tracking-tighter italic leading-[0.9] text-slate-900 dark:text-white">
                                    Supply <br /><span className="text-amber-500">Chain</span>
                                </h2>
                                <p className="text-xl font-medium text-slate-600 dark:text-white/40 leading-relaxed italic max-w-md">
                                    Inventory and logistics orchestration layer. End-to-end supply chain visibility and fleet dispatch telemetry.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 backdrop-blur-md">
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-amber-600/60 mb-1">Fleet_Active</span>
                                    <span className="text-3xl font-black italic text-amber-500 tracking-tighter">14/15</span>
                                </div>
                                <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 backdrop-blur-md">
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-amber-600/60 mb-1">Turnover_Index</span>
                                    <span className="text-3xl font-black italic text-amber-500 tracking-tighter">14.2X</span>
                                </div>
                            </div>
                            <GlassCard className="p-8 cursor-pointer relative z-10" accent="amber" onClick={() => openModule("SCM", "amber", MODULE_DATA.SCM)}>
                                <InventoryTreadmill />
                            </GlassCard>
                        </div>
                        <div className="lg:pt-20">
                            <div className="relative">
                                <div className="absolute -inset-10 bg-amber-500/10 blur-[100px] rounded-full" />
                                <GlobalHealthViz />
                            </div>
                        </div>
                    </motion.div>
                </HorizontalPanel>

                {/* 5. CUSTOMER RELATIONSHIP (INDIGO) */}
                <HorizontalPanel className="px-6 md:px-12 lg:px-24 overflow-hidden">
                    {/* Background Aura */}
                    <div className="absolute inset-0 z-0">
                        <motion.img 
                            initial={{ scale: 1.3, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 0.15 }}
                            transition={{ duration: 2.5 }}
                            src="/crm_tech_bg_1776080448439.png" 
                            className="w-full h-full object-cover blur-[140px]"
                        />
                    </div>
                    {/* Floating Vertical Text */}
                    <div className="absolute left-20 top-0 bottom-0 select-none pointer-events-none opacity-5 dark:opacity-10 z-0 flex items-center">
                        <span className="text-[18rem] font-black uppercase tracking-tighter rotate-90 italic leading-none text-indigo-500">CUSTOMER</span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}
                        className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10"
                    >
                        <div className="lg:col-span-6 space-y-12">
                            <div className="space-y-6">
                                <h2 className="text-5xl md:text-[5rem] font-black uppercase tracking-tighter italic leading-[0.9] text-slate-900 dark:text-white">
                                    Customer <br /><span className="text-indigo-500">RELATIONSHIP</span>
                                </h2>
                                <p className="font-medium text-slate-600 dark:text-white/40 text-xl leading-relaxed max-w-md italic">
                                    Revenue pipeline and client hub. Billing engine tracking every order from creation to payment.
                                </p>
                            </div>
                            <Button
                                onClick={() => openModule("CRM", "indigo", MODULE_DATA.CRM)}
                                className="rounded-full bg-indigo-500/10 border border-indigo-500/50 text-indigo-700 dark:text-indigo-400 font-black uppercase tracking-widest text-[10px] px-12 h-14 hover:bg-indigo-500 hover:text-white transition-all shadow-[0_0_40px_rgba(99,102,241,0.15)]"
                            >
                                Executive Insights
                            </Button>
                        </div>
                        <div className="lg:col-span-6 flex items-center justify-center">
                            <div className="relative w-full max-w-lg aspect-square">
                                <div className="absolute inset-0 bg-indigo-500/30 blur-[150px] rounded-full animate-pulse" />
                                <ConnectionNode />
                                <div className="absolute -bottom-10 -right-10 w-64">
                                    <GlassCard className="p-6 relative z-10" accent="indigo" onClick={() => openModule("CRM", "indigo", MODULE_DATA.CRM)}>
                                        <ReceivablesAging />
                                    </GlassCard>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </HorizontalPanel>

                {/* 6. BUSINESS INTELLIGENCE (VIOLET) */}
                <HorizontalPanel className="px-6 md:px-12 lg:px-24 overflow-hidden relative">
                    {/* Background Aura */}
                    <div className="absolute inset-x-0 bottom-0 top-0 z-0 flex items-center justify-center">
                        <motion.img 
                            initial={{ scale: 0.8, opacity: 0 }}
                            whileInView={{ scale: 1.2, opacity: 0.2 }}
                            transition={{ duration: 3 }}
                            src="/bi_tech_bg_1776080465405.png" 
                            className="w-[120%] h-[120%] object-cover blur-[100px]"
                        />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 1.05 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="w-full max-w-7xl mx-auto space-y-24 relative z-10"
                    >
                        <div className="flex flex-col items-center text-center space-y-8">
                            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 backdrop-blur-xl animate-bounce-slow">
                                <Cpu className="w-10 h-10 text-violet-500" />
                            </div>
                            <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none text-slate-900 dark:text-white">
                                System <br /><span className="text-violet-500">Intelligence</span>
                            </h2>
                            <p className="max-w-xl text-slate-600 dark:text-white/40 text-2xl font-medium italic leading-relaxed">
                                Aggregated analytics stream correlating stock, sales, and fiscal performance nodes.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-stretch">
                            <div className="flex flex-col gap-12 justify-center">
                                <div className="p-10 rounded-2xl bg-violet-500/5 border border-violet-500/10 backdrop-blur-3xl shadow-2xl hover:bg-violet-500/10 transition-colors cursor-pointer group">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-40 group-hover:opacity-100 transition-opacity">Neural_Net_Status</h4>
                                    <p className="text-4xl font-black italic tracking-tighter text-violet-500">94.8% <span className="text-xs uppercase font-medium tracking-normal opacity-50 block mt-2">Integrity Optimized</span></p>
                                </div>
                            </div>
                            <div className="lg:col-span-2 relative">
                                <GlassCard className="p-10 relative z-20 h-full flex items-center justify-center bg-slate-900/5 dark:bg-slate-900/40" accent="violet" onClick={() => openModule("BI", "violet", MODULE_DATA.BI)}>
                                    <div className="w-full scale-110"><AnalyticsWorkbench /></div>
                                </GlassCard>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] aspect-square bg-violet-600/5 blur-[120px] rounded-full z-0" />
                            </div>
                        </div>
                    </motion.div>
                </HorizontalPanel>

                {/* 7. AUDIT RESULTS & FINDINGS (ROSE) */}
                <HorizontalPanel className="px-6 md:px-12 lg:px-24 overflow-hidden relative">
                    {/* Background Aura */}
                    <div className="absolute inset-0 z-0">
                        <motion.img 
                            initial={{ scale: 1.2, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 0.1 }}
                            transition={{ duration: 2 }}
                            src="/arf_tech_bg_1776080481672.png" 
                            className="w-full h-full object-cover blur-[150px]"
                        />
                    </div>
                    {/* Red Matrix Vertical Scrollers (Aura Text) */}
                    <div className="absolute right-32 top-0 bottom-0 select-none pointer-events-none opacity-5 dark:opacity-10 z-0 writing-vertical-rl">
                        <span className="text-[12rem] font-black uppercase tracking-[1rem] leading-none text-rose-500">COMPLIANCE_PROTOCOL_7.0</span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10"
                    >
                        <div className="lg:col-span-5 space-y-8">
                            <div className="flex items-center gap-6">
                                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
                                    <Shield className="w-12 h-12 text-rose-500" />
                                </div>
                                <div className="h-px grow bg-linear-to-r from-rose-500/50 to-transparent" />
                            </div>
                            <h2 className="text-5xl md:text-[5.5rem] font-black uppercase tracking-tighter italic leading-[0.85] text-slate-900 dark:text-white">
                                AUDIT RESULTS <br /><span className="text-rose-500">& FINDINGS</span>
                            </h2>
                            <p className="text-slate-600 dark:text-white/40 text-xl leading-relaxed font-medium italic max-w-md">
                                Audit Trails and Compliance Gaps. Monitoring risk remediation velocity across all domains.
                            </p>
                            <div className="flex gap-4">
                                <div className="px-5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest">Non-Repudiable</div>
                                <div className="px-5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest">TLS_E2EE</div>
                            </div>
                            <Button
                                onClick={() => openModule("ARF", "rose", MODULE_DATA.ARF)}
                                className="rounded-full bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] px-12 h-14 hover:bg-rose-600 transition-all shadow-[0_10px_40px_-10px_rgba(244,63,94,0.5)] active:scale-95"
                            >
                                Security Audit Log
                            </Button>
                        </div>
                        <div className="lg:col-span-7">
                            <GlassCard className="p-6 cursor-pointer relative z-10 border-rose-500/30" accent="rose" onClick={() => openModule("ARF", "rose", MODULE_DATA.ARF)}>
                                <MatrixAuditLog />
                            </GlassCard>
                        </div>
                    </motion.div>
                </HorizontalPanel>

            </HorizontalScrollContainer>

            {/* FOOTER */}
            <footer className="relative py-32 px-6 border-t border-slate-900/5 dark:border-white/5 bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[150px] pointer-events-none" />
                <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-12 relative z-10">
                    <div className="p-6 rounded-full bg-slate-900/[0.02] dark:bg-white/[0.02] border border-slate-900/5 dark:border-white/5 backdrop-blur-xl hover:scale-110 transition-transform">
                        <Settings className="w-12 h-12 text-cyan-600 dark:text-cyan-500 animate-spin-slow" />
                    </div>
                    <div className="space-y-6">
                        <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">Ready to Deploy?</h3>
                        <p className="max-w-xl mx-auto text-slate-600 dark:text-white/50 text-xl font-medium">
                            VOS-WEB-V2 is built for enterprise scale. <br />
                            HRM · Finance · SCM · CRM · BI · Audit — on a single platform.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6">
                        <Button className="rounded-full h-14 px-10 bg-cyan-500 hover:bg-cyan-400 text-slate-50 dark:text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)]">
                            Establish Integration
                        </Button>
                        <Button variant="outline" className="rounded-full h-14 px-10 border-slate-900/10 dark:border-white/10 hover:bg-slate-900/5 dark:hover:bg-white/5 font-black uppercase tracking-widest text-sm text-slate-900 dark:text-white transition-colors">
                            View Documentation
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    )
}

