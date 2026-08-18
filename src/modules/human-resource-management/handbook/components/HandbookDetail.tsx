"use client";

import { useHandbook } from "../hooks/useHandbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Download, BookOpen, Calendar, AlignLeft, Paperclip, Eye, ZoomIn, ZoomOut, Edit } from "lucide-react";
import { useState } from "react";

export function HandbookDetail() {
    const { isDetailOpen, setIsDetailOpen, setIsEditOpen, selectedHandbook } = useHandbook();
    const [previewAtt, setPreviewAtt] = useState<{ url: string; name: string } | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    if (!selectedHandbook) return null;

    const isImage = (filename: string) => {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
    };

    const openPreview = (url: string, name: string) => {
        setPreviewAtt({ url, name });
        setZoomLevel(1);
    };

    return (
        <>
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-8 py-8 border-b">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/20 rounded-xl shadow-sm border border-primary/10">
                                <BookOpen className="w-8 h-8 text-primary" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                                    {selectedHandbook.title}
                                </DialogTitle>
                                <DialogDescription className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                    <Calendar className="w-4 h-4" />
                                    Created by <span className="text-foreground">{selectedHandbook.created_by_name || "Unknown"}</span> on{" "}
                                    {selectedHandbook.created_at ? format(new Date(selectedHandbook.created_at), "MMMM do, yyyy") : "-"}
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {/* Description Section */}
                        {selectedHandbook.description && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-foreground font-semibold">
                                    <AlignLeft className="w-5 h-5 text-primary" />
                                    <h3>Description</h3>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 rounded-full"></div>
                                    <p className="text-base text-muted-foreground whitespace-pre-wrap pl-5 leading-relaxed">
                                        {selectedHandbook.description}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Attachments Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-foreground font-semibold mb-4">
                                <Paperclip className="w-5 h-5 text-primary" />
                                <h3>Attachments <span className="text-muted-foreground font-normal ml-1">({selectedHandbook.attachments?.length || 0})</span></h3>
                            </div>
                            
                            {selectedHandbook.attachments && selectedHandbook.attachments.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedHandbook.attachments.map((att) => (
                                        <div 
                                            key={att.id} 
                                            className="group flex flex-col justify-between p-4 border border-border/50 rounded-xl bg-card hover:bg-accent/5 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors shrink-0">
                                                    <FileText className="h-6 w-6 text-blue-600" />
                                                </div>
                                                <span className="text-sm font-medium line-clamp-2 mt-1" title={att.file_name}>
                                                    {att.file_name}
                                                </span>
                                            </div>
                                            
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full bg-secondary/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                                                onClick={() => openPreview(`http://goatedcodoer:8056/assets/${att.file_url}`, att.file_name)}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                Preview
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-xl bg-muted/10">
                                    <div className="p-3 bg-muted rounded-full mb-3">
                                        <Paperclip className="w-6 h-6 text-muted-foreground/50" />
                                    </div>
                                    <p className="text-sm text-muted-foreground font-medium">No attachments uploaded for this handbook.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="px-8 py-5 border-t bg-muted/20 flex justify-between sm:justify-between items-center">
                        <Button 
                            variant="secondary" 
                            className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors"
                            onClick={() => {
                                setIsDetailOpen(false);
                                setIsEditOpen(true);
                            }}
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Handbook
                        </Button>
                        <Button variant="outline" className="px-8 rounded-full" onClick={() => setIsDetailOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Modal */}
            <Dialog open={!!previewAtt} onOpenChange={(open) => !open && setPreviewAtt(null)}>
                <DialogContent className="max-w-[90vw] lg:max-w-7xl h-[90vh] p-0 flex flex-col overflow-hidden bg-background border-none shadow-2xl rounded-2xl [&>button]:hidden">
                    <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
                        <DialogTitle className="text-xl font-bold truncate pr-4 flex-1">{previewAtt?.name}</DialogTitle>
                        {previewAtt && isImage(previewAtt.name) && (
                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))}>
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoomLevel(z => Math.min(5, z + 0.25))}>
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </DialogHeader>
                    <div className="flex-1 min-h-0 bg-muted/30 overflow-auto flex items-center justify-center">
                        {previewAtt && isImage(previewAtt.name) ? (
                            <div className="p-4 flex items-center justify-center min-w-full min-h-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                    src={previewAtt.url} 
                                    alt={previewAtt.name} 
                                    className="max-w-none shadow-md transition-transform duration-200"
                                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                                />
                            </div>
                        ) : previewAtt ? (
                            <iframe 
                                src={previewAtt.url} 
                                className="w-full h-full border-none"
                                title={previewAtt.name}
                            />
                        ) : null}
                    </div>
                    <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex items-center justify-between">
                        {previewAtt && (
                            <Button asChild className="mr-auto" variant="outline">
                                <a href={`${previewAtt.url}?download`} target="_blank" rel="noreferrer">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Instead
                                </a>
                            </Button>
                        )}
                        <Button onClick={() => setPreviewAtt(null)}>Close Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
