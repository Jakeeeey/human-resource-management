"use client";

import React from "react";
import * as Icons from "lucide-react";
import { 
    Search, 
    ChevronDown, 
    Check,
    X,
    LucideIcon,
} from "lucide-react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * UNIQUE CURATED ERP ICON SET
 * Deduplicated and optimized for HRM/ERP subsystems.
 */
const CURATED_ICONS = [
    { name: "Accessibility", icon: Icons.Accessibility },
    { name: "Activity", icon: Icons.Activity },
    { name: "AlarmClock", icon: Icons.AlarmClock },
    { name: "AlarmClockCheck", icon: Icons.AlarmClockCheck },
    { name: "AlarmClockOff", icon: Icons.AlarmClockOff },
    { name: "AlertCircle", icon: Icons.AlertCircle },
    { name: "AlertOctagon", icon: Icons.AlertOctagon },
    { name: "AlertTriangle", icon: Icons.AlertTriangle },
    { name: "Anchor", icon: Icons.Anchor },
    { name: "Anvil", icon: Icons.Anvil },
    { name: "AppWindow", icon: Icons.AppWindow },
    { name: "Archive", icon: Icons.Archive },
    { name: "ArchiveRestore", icon: Icons.ArchiveRestore },
    { name: "AreaChart", icon: Icons.AreaChart },
    { name: "ArrowDown", icon: Icons.ArrowDown },
    { name: "ArrowLeft", icon: Icons.ArrowLeft },
    { name: "ArrowRight", icon: Icons.ArrowRight },
    { name: "ArrowUp", icon: Icons.ArrowUp },
    { name: "ArrowUpRight", icon: Icons.ArrowUpRight },
    { name: "AtSign", icon: Icons.AtSign },
    { name: "Atom", icon: Icons.Atom },
    { name: "Award", icon: Icons.Award },
    { name: "Baby", icon: Icons.Baby },
    { name: "BadgeCheck", icon: Icons.BadgeCheck },
    { name: "BadgeDollarSign", icon: Icons.BadgeDollarSign },
    { name: "BadgeInfo", icon: Icons.BadgeInfo },
    { name: "Ban", icon: Icons.Ban },
    { name: "Banknote", icon: Icons.Banknote },
    { name: "BarChart", icon: Icons.BarChart },
    { name: "BarChart2", icon: Icons.BarChart2 },
    { name: "BarChart3", icon: Icons.BarChart3 },
    { name: "BarChart4", icon: Icons.BarChart4 },
    { name: "BarChartBig", icon: Icons.BarChartBig },
    { name: "BarChartHorizontal", icon: Icons.BarChartHorizontal },
    { name: "Beaker", icon: Icons.Beaker },
    { name: "Bell", icon: Icons.Bell },
    { name: "BellDot", icon: Icons.BellDot },
    { name: "BellOff", icon: Icons.BellOff },
    { name: "Binary", icon: Icons.Binary },
    { name: "Blocks", icon: Icons.Blocks },
    { name: "Bolt", icon: Icons.Bolt },
    { name: "Book", icon: Icons.Book },
    { name: "BookOpen", icon: Icons.BookOpen },
    { name: "Bookmark", icon: Icons.Bookmark },
    { name: "Box", icon: Icons.Box },
    { name: "Boxes", icon: Icons.Boxes },
    { name: "Brain", icon: Icons.Brain },
    { name: "Briefcase", icon: Icons.Briefcase },
    { name: "Building2", icon: Icons.Building2 },
    { name: "Calculator", icon: Icons.Calculator },
    { name: "Calendar", icon: Icons.Calendar },
    { name: "CalendarCheck", icon: Icons.CalendarCheck },
    { name: "CalendarDays", icon: Icons.CalendarDays },
    { name: "CalendarHeart", icon: Icons.CalendarHeart },
    { name: "CalendarMinus", icon: Icons.CalendarMinus },
    { name: "CalendarPlus", icon: Icons.CalendarPlus },
    { name: "CalendarRange", icon: Icons.CalendarRange },
    { name: "CalendarSearch", icon: Icons.CalendarSearch },
    { name: "Camera", icon: Icons.Camera },
    { name: "Car", icon: Icons.Car },
    { name: "Cast", icon: Icons.Cast },
    { name: "Check", icon: Icons.Check },
    { name: "CheckCheck", icon: Icons.CheckCheck },
    { name: "CheckCircle", icon: Icons.CheckCircle },
    { name: "CheckCircle2", icon: Icons.CheckCircle2 },
    { name: "CircleDollarSign", icon: Icons.CircleDollarSign },
    { name: "CircleSlash", icon: Icons.CircleSlash },
    { name: "Clipboard", icon: Icons.Clipboard },
    { name: "ClipboardCheck", icon: Icons.ClipboardCheck },
    { name: "ClipboardList", icon: Icons.ClipboardList },
    { name: "Clock", icon: Icons.Clock },
    { name: "Clock1", icon: Icons.Clock1 },
    { name: "Clock2", icon: Icons.Clock2 },
    { name: "Clock3", icon: Icons.Clock3 },
    { name: "Cloud", icon: Icons.Cloud },
    { name: "CloudDownload", icon: Icons.CloudDownload },
    { name: "CloudUpload", icon: Icons.CloudUpload },
    { name: "Code", icon: Icons.Code },
    { name: "Code2", icon: Icons.Code2 },
    { name: "Cog", icon: Icons.Cog },
    { name: "Coins", icon: Icons.Coins },
    { name: "Command", icon: Icons.Command },
    { name: "Compass", icon: Icons.Compass },
    { name: "Component", icon: Icons.Component },
    { name: "Construction", icon: Icons.Construction },
    { name: "Contact", icon: Icons.Contact },
    { name: "Container", icon: Icons.Container },
    { name: "Copy", icon: Icons.Copy },
    { name: "Cpu", icon: Icons.Cpu },
    { name: "CreditCard", icon: Icons.CreditCard },
    { name: "Crown", icon: Icons.Crown },
    { name: "Cylinder", icon: Icons.Cylinder },
    { name: "Database", icon: Icons.Database },
    { name: "DatabaseBackup", icon: Icons.DatabaseBackup },
    { name: "Dna", icon: Icons.Dna },
    { name: "DollarSign", icon: Icons.DollarSign },
    { name: "Dot", icon: Icons.Dot },
    { name: "Download", icon: Icons.Download },
    { name: "Drill", icon: Icons.Drill },
    { name: "Droplets", icon: Icons.Droplets },
    { name: "Edit", icon: Icons.Edit },
    { name: "Edit2", icon: Icons.Edit2 },
    { name: "Edit3", icon: Icons.Edit3 },
    { name: "Euro", icon: Icons.Euro },
    { name: "ExternalLink", icon: Icons.ExternalLink },
    { name: "Eye", icon: Icons.Eye },
    { name: "EyeOff", icon: Icons.EyeOff },
    { name: "Factory", icon: Icons.Factory },
    { name: "File", icon: Icons.File },
    { name: "FileBadge", icon: Icons.FileBadge },
    { name: "FileBarChart", icon: Icons.FileBarChart },
    { name: "FileCheck", icon: Icons.FileCheck },
    { name: "FileCode", icon: Icons.FileCode },
    { name: "FileDigit", icon: Icons.FileDigit },
    { name: "FileDown", icon: Icons.FileDown },
    { name: "FileEdit", icon: Icons.FileEdit },
    { name: "FileMinus", icon: Icons.FileMinus },
    { name: "FilePlus", icon: Icons.FilePlus },
    { name: "FileQuestion", icon: Icons.FileQuestion },
    { name: "FileSearch", icon: Icons.FileSearch },
    { name: "FileSpreadsheet", icon: Icons.FileSpreadsheet },
    { name: "FileStack", icon: Icons.FileStack },
    { name: "FileText", icon: Icons.FileText },
    { name: "FileUp", icon: Icons.FileUp },
    { name: "FileVideo", icon: Icons.FileVideo },
    { name: "FileWarning", icon: Icons.FileWarning },
    { name: "Files", icon: Icons.Files },
    { name: "Filter", icon: Icons.Filter },
    { name: "Fingerprint", icon: Icons.Fingerprint },
    { name: "Flag", icon: Icons.Flag },
    { name: "FlaskConical", icon: Icons.FlaskConical },
    { name: "Folder", icon: Icons.Folder },
    { name: "FolderClosed", icon: Icons.FolderClosed },
    { name: "FolderLock", icon: Icons.FolderLock },
    { name: "FolderOpen", icon: Icons.FolderOpen },
    { name: "FolderSearch", icon: Icons.FolderSearch },
    { name: "Fuel", icon: Icons.Fuel },
    { name: "GanttChart", icon: Icons.GanttChart },
    { name: "GanttChartSquare", icon: Icons.GanttChartSquare },
    { name: "Gem", icon: Icons.Gem },
    { name: "Ghost", icon: Icons.Ghost },
    { name: "Gift", icon: Icons.Gift },
    { name: "Globe", icon: Icons.Globe },
    { name: "GraduationCap", icon: Icons.GraduationCap },
    { name: "Grid", icon: Icons.Grid },
    { name: "GripHorizontal", icon: Icons.GripHorizontal },
    { name: "GripVertical", icon: Icons.GripVertical },
    { name: "Hammer", icon: Icons.Hammer },
    { name: "Handshake", icon: Icons.Handshake },
    { name: "HardDrive", icon: Icons.HardDrive },
    { name: "HardHat", icon: Icons.HardHat },
    { name: "Hash", icon: Icons.Hash },
    { name: "Heart", icon: Icons.Heart },
    { name: "HeartPulse", icon: Icons.HeartPulse },
    { name: "HelpCircle", icon: Icons.HelpCircle },
    { name: "History", icon: Icons.History },
    { name: "Home", icon: Icons.Home },
    { name: "Hospital", icon: Icons.Hospital },
    { name: "Hotel", icon: Icons.Hotel },
    { name: "Hourglass", icon: Icons.Hourglass },
    { name: "IdCard", icon: Icons.IdCard },
    { name: "Image", icon: Icons.Image },
    { name: "Inbox", icon: Icons.Inbox },
    { name: "Info", icon: Icons.Info },
    { name: "Key", icon: Icons.Key },
    { name: "KeyRound", icon: Icons.KeyRound },
    { name: "Landmark", icon: Icons.Landmark },
    { name: "Languages", icon: Icons.Languages },
    { name: "Laptop", icon: Icons.Laptop },
    { name: "Layers", icon: Icons.Layers },
    { name: "Layout", icon: Icons.Layout },
    { name: "LayoutDashboard", icon: Icons.LayoutDashboard },
    { name: "LayoutGrid", icon: Icons.LayoutGrid },
    { name: "LayoutList", icon: Icons.LayoutList },
    { name: "Library", icon: Icons.Library },
    { name: "LifeBuoy", icon: Icons.LifeBuoy },
    { name: "LineChart", icon: Icons.LineChart },
    { name: "Link", icon: Icons.Link },
    { name: "Link2", icon: Icons.Link2 },
    { name: "List", icon: Icons.List },
    { name: "ListChecks", icon: Icons.ListChecks },
    { name: "Locate", icon: Icons.Locate },
    { name: "LocateFixed", icon: Icons.LocateFixed },
    { name: "Lock", icon: Icons.Lock },
    { name: "LockKeyhole", icon: Icons.LockKeyhole },
    { name: "LogIn", icon: Icons.LogIn },
    { name: "LogOut", icon: Icons.LogOut },
    { name: "Luggage", icon: Icons.Luggage },
    { name: "Mail", icon: Icons.Mail },
    { name: "Map", icon: Icons.Map },
    { name: "MapPin", icon: Icons.MapPin },
    { name: "Maximize", icon: Icons.Maximize },
    { name: "Maximize2", icon: Icons.Maximize2 },
    { name: "Medal", icon: Icons.Medal },
    { name: "Menu", icon: Icons.Menu },
    { name: "MessageCircle", icon: Icons.MessageCircle },
    { name: "MessageSquare", icon: Icons.MessageSquare },
    { name: "MessagesSquare", icon: Icons.MessagesSquare },
    { name: "Mic", icon: Icons.Mic },
    { name: "Microscope", icon: Icons.Microscope },
    { name: "Milestone", icon: Icons.Milestone },
    { name: "Minimize", icon: Icons.Minimize },
    { name: "Minimize2", icon: Icons.Minimize2 },
    { name: "Monitor", icon: Icons.Monitor },
    { name: "Moon", icon: Icons.Moon },
    { name: "MoreHorizontal", icon: Icons.MoreHorizontal },
    { name: "MoreVertical", icon: Icons.MoreVertical },
    { name: "Mouse", icon: Icons.Mouse },
    { name: "Navigation", icon: Icons.Navigation },
    { name: "Network", icon: Icons.Network },
    { name: "Notebook", icon: Icons.Notebook },
    { name: "Orbit", icon: Icons.Orbit },
    { name: "Package", icon: Icons.Package },
    { name: "Package2", icon: Icons.Package2 },
    { name: "PackageCheck", icon: Icons.PackageCheck },
    { name: "PackageOpen", icon: Icons.PackageOpen },
    { name: "PackageSearch", icon: Icons.PackageSearch },
    { name: "PackageX", icon: Icons.PackageX },
    { name: "PanelLeft", icon: Icons.PanelLeft },
    { name: "PanelRight", icon: Icons.PanelRight },
    { name: "Paperclip", icon: Icons.Paperclip },
    { name: "PartyPopper", icon: Icons.PartyPopper },
    { name: "Pencil", icon: Icons.Pencil },
    { name: "PenTool", icon: Icons.PenTool },
    { name: "PieChart", icon: Icons.PieChart },
    { name: "PiggyBank", icon: Icons.PiggyBank },
    { name: "Pipette", icon: Icons.Pipette },
    { name: "Plane", icon: Icons.Plane },
    { name: "Plus", icon: Icons.Plus },
    { name: "PlusCircle", icon: Icons.PlusCircle },
    { name: "PoundSterling", icon: Icons.PoundSterling },
    { name: "Power", icon: Icons.Power },
    { name: "Presentation", icon: Icons.Presentation },
    { name: "Printer", icon: Icons.Printer },
    { name: "Radar", icon: Icons.Radar },
    { name: "Radio", icon: Icons.Radio },
    { name: "Receipt", icon: Icons.Receipt },
    { name: "RefreshCcw", icon: Icons.RefreshCcw },
    { name: "RefreshCw", icon: Icons.RefreshCw },
    { name: "RotateCcw", icon: Icons.RotateCcw },
    { name: "RotateCw", icon: Icons.RotateCw },
    { name: "Route", icon: Icons.Route },
    { name: "Save", icon: Icons.Save },
    { name: "Scale", icon: Icons.Scale },
    { name: "ScatterChart", icon: Icons.ScatterChart },
    { name: "School", icon: Icons.School },
    { name: "Search", icon: Icons.Search },
    { name: "Server", icon: Icons.Server },
    { name: "Settings", icon: Icons.Settings },
    { name: "Settings2", icon: Icons.Settings2 },
    { name: "Share", icon: Icons.Share },
    { name: "Share2", icon: Icons.Share2 },
    { name: "Shield", icon: Icons.Shield },
    { name: "ShieldAlert", icon: Icons.ShieldAlert },
    { name: "ShieldCheck", icon: Icons.ShieldCheck },
    { name: "ShieldQuestion", icon: Icons.ShieldQuestion },
    { name: "Ship", icon: Icons.Ship },
    { name: "ShoppingBag", icon: Icons.ShoppingBag },
    { name: "ShoppingCart", icon: Icons.ShoppingCart },
    { name: "Shuffle", icon: Icons.Shuffle },
    { name: "Sliders", icon: Icons.Sliders },
    { name: "SlidersHorizontal", icon: Icons.SlidersHorizontal },
    { name: "Smartphone", icon: Icons.Smartphone },
    { name: "Smile", icon: Icons.Smile },
    { name: "Sparkles", icon: Icons.Sparkles },
    { name: "Sprout", icon: Icons.Sprout },
    { name: "Star", icon: Icons.Star },
    { name: "Stethoscope", icon: Icons.Stethoscope },
    { name: "StickyNote", icon: Icons.StickyNote },
    { name: "Store", icon: Icons.Store },
    { name: "Sun", icon: Icons.Sun },
    { name: "Table", icon: Icons.Table },
    { name: "Tablet", icon: Icons.Tablet },
    { name: "Tag", icon: Icons.Tag },
    { name: "Target", icon: Icons.Target },
    { name: "Terminal", icon: Icons.Terminal },
    { name: "Theater", icon: Icons.Theater },
    { name: "ThumbsDown", icon: Icons.ThumbsDown },
    { name: "ThumbsUp", icon: Icons.ThumbsUp },
    { name: "Ticket", icon: Icons.Ticket },
    { name: "Timer", icon: Icons.Timer },
    { name: "TimerOff", icon: Icons.TimerOff },
    { name: "ToggleLeft", icon: Icons.ToggleLeft },
    { name: "ToggleRight", icon: Icons.ToggleRight },
    { name: "Trash", icon: Icons.Trash },
    { name: "Trash2", icon: Icons.Trash2 },
    { name: "TrendingDown", icon: Icons.TrendingDown },
    { name: "TrendingUp", icon: Icons.TrendingUp },
    { name: "Trophy", icon: Icons.Trophy },
    { name: "Truck", icon: Icons.Truck },
    { name: "Type", icon: Icons.Type },
    { name: "Umbrella", icon: Icons.Umbrella },
    { name: "Unlock", icon: Icons.Unlock },
    { name: "Upload", icon: Icons.Upload },
    { name: "User", icon: Icons.User },
    { name: "UserCheck", icon: Icons.UserCheck },
    { name: "UserCog", icon: Icons.UserCog },
    { name: "UserMinus", icon: Icons.UserMinus },
    { name: "UserPlus", icon: Icons.UserPlus },
    { name: "UserX", icon: Icons.UserX },
    { name: "Users", icon: Icons.Users },
    { name: "Verified", icon: Icons.Verified },
    { name: "Video", icon: Icons.Video },
    { name: "Wallet", icon: Icons.Wallet },
    { name: "Warehouse", icon: Icons.Warehouse },
    { name: "Watch", icon: Icons.Watch },
    { name: "Wifi", icon: Icons.Wifi },
    { name: "Workflow", icon: Icons.Workflow },
    { name: "Wrench", icon: Icons.Wrench },
    { name: "Zap", icon: Icons.Zap },
];

interface IconPickerProps {
    value: string;
    onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    const [search, setSearch] = React.useState("");
    const [open, setOpen] = React.useState(false);

    const filteredIcons = React.useMemo(() => {
        return CURATED_ICONS.filter(icon => 
            icon.name.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    // Dynamically get the currently selected icon component
    const SelectedIcon = (Icons as unknown as Record<string, LucideIcon>)[value] || Icons.Box;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className="h-10 w-full justify-between rounded-xl border-muted-foreground/10 focus:ring-primary/20 bg-card px-3 font-bold transition-all hover:bg-muted/5 active:scale-[0.98] shadow-sm overflow-hidden"
                >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="bg-primary/5 p-1.5 rounded-lg border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                            <SelectedIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="truncate text-[11px] font-black uppercase tracking-widest text-foreground/80">
                            {value || "Select Icon"}
                        </span>
                    </div>
                    <ChevronDown className="h-3 w-3 opacity-40 shrink-0 ml-2" />
                </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[420px] overflow-hidden rounded-2xl border shadow-2xl bg-background/95 backdrop-blur-xl z-[1000] flex flex-col h-[550px]">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative flex-none">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                Select Icon
                            </DialogTitle>
                        </div>
                        <DialogClose asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-muted/30">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </div>
                    <div className="mt-4 relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50 group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Search among 300+ unique icons..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                            className="pl-10 h-11 rounded-2xl bg-background border-muted-foreground/10 focus-visible:ring-primary/20 font-bold text-sm shadow-inner"
                        />
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 w-full bg-primary/[0.005]">
                    <div className="p-5">
                        <div className="grid grid-cols-4 gap-3">
                            {filteredIcons.map((iconItem) => {
                                const IconComp = iconItem.icon;
                                const isSelected = value === iconItem.name;
                                
                                return (
                                    <button
                                        key={iconItem.name}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onChange(iconItem.name);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-[1.25rem] transition-all duration-300 group/icon relative aspect-square border-2",
                                            isSelected 
                                                ? "bg-primary/5 text-primary border-primary shadow-lg shadow-primary/5 scale-105 z-10" 
                                                : "hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5 text-muted-foreground hover:text-primary border-transparent hover:border-primary/20"
                                        )}
                                        title={iconItem.name}
                                    >
                                        <IconComp className={cn(
                                            "h-6 w-6 mb-2 transition-transform duration-300",
                                            isSelected ? "text-primary scale-110" : "group-hover/icon:scale-110"
                                        )} />
                                        <span className={cn(
                                            "text-[7px] font-black uppercase tracking-tighter truncate w-full text-center opacity-60 leading-none",
                                            isSelected && "opacity-100 text-primary"
                                        )}>
                                            {iconItem.name}
                                        </span>
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full shadow-sm p-0.5 z-20">
                                                <Check className="h-2 w-2" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                            {filteredIcons.length === 0 && (
                                <div className="col-span-4 py-20 flex flex-col items-center justify-center text-muted-foreground opacity-40">
                                    <Search className="h-12 w-12 mb-4 stroke-[1px]" />
                                    <span className="text-xs font-bold uppercase tracking-widest">No matching registry icons</span>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
