"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Loader2, 
  AlertCircle,
  FolderOpen,
  Folder,
  ChevronLeft,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  User, 
  EmployeeFileRecordDisplay, 
  EmployeeFileRecordType,
  EmployeeFileRecordList
} from "../types";
import { 
  getEmployeeFileRecordsDirectus, 
  getRecordTypesDirectus,
  getRecordListsDirectus,
  createEmployeeFileRecordDirectus,
  deleteEmployeeFileRecordDirectus
} from "../providers/directusProvider";
import { cn, formatDateTime } from "@/lib/utils";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

const UPLOAD_API = "/api/hrm/employee-admin/employee-master-list/upload";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface EmployeeFilesTabProps {
  user: User;
}

export function EmployeeFilesTab({ user }: EmployeeFilesTabProps) {
  const [records, setRecords] = useState<EmployeeFileRecordDisplay[]>([]);
  const [types, setTypes] = useState<EmployeeFileRecordType[]>([]);
  const [lists, setLists] = useState<EmployeeFileRecordList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [draggedOverGridFolder, setDraggedOverGridFolder] = useState<string | null>(null);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<EmployeeFileRecordDisplay | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for new record
  const [uploadBatch, setUploadBatch] = useState({
    typeId: "",
    listId: "",
    description: "",
    files: [] as { file: File, name: string, id: string }[]
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    const handleGlobalDrag = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", handleGlobalDrag);
    window.addEventListener("dragenter", handleGlobalDrag);
    window.addEventListener("dragend", handleGlobalDrag);
    window.addEventListener("drop", handleGlobalDrag);
    return () => {
      window.removeEventListener("dragover", handleGlobalDrag);
      window.removeEventListener("dragenter", handleGlobalDrag);
      window.removeEventListener("dragend", handleGlobalDrag);
      window.removeEventListener("drop", handleGlobalDrag);
    };
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [recordData, typeData, listData] = await Promise.all([
        getEmployeeFileRecordsDirectus(user.id),
        getRecordTypesDirectus(),
        getRecordListsDirectus()
      ]);
      setRecords(recordData);
      setTypes(typeData);
      setLists(listData);
    } catch (error) {
      console.error("Failed to load 201 files data:", error);
      toast.error("Failed to load employee records");
    } finally {
      setIsLoading(false);
    }
  }


  async function handleUpload() {
    if (uploadBatch.files.length === 0 || !uploadBatch.typeId || !uploadBatch.listId) {
        toast.error("Please fill in all required fields and select at least one file");
        return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(uploadBatch.files.map(async (fileItem) => {
        try {
          // 1. Upload file to Directus
          const file = fileItem.file;
          
          let uploadFile = file;
          if (file.type.startsWith("image/")) {
            uploadFile = await imageCompression(file, {
              maxSizeMB: 1,
              maxWidthOrHeight: 2048,
              useWebWorker: true,
            });
          }

          const fd = new FormData();
          fd.append("file", uploadFile, file.name);
          const res = await fetch(`${UPLOAD_API}?type=employee_file`, { method: "POST", body: fd });
          
          if (!res.ok) throw new Error(`Upload failed for ${fileItem.name}`);
          const json = await res.json();
          const fileId = json?.data?.id;
          
          if (!fileId) throw new Error(`Directus error for ${fileItem.name}`);

          // 2. Create record
          await createEmployeeFileRecordDirectus({
            user_id: user.id,
            list_id: Number(uploadBatch.listId),
            record_name: fileItem.name,
            description: uploadBatch.description,
            file_ref: fileId
          });
          successCount++;
        } catch (err) {
          console.error(`Error uploading ${fileItem.name}:`, err);
          failCount++;
        }
      }));

      if (failCount === 0) {
        toast.success(`Successfully uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`);
      } else if (successCount > 0) {
        toast.warning(`Uploaded ${successCount} files, but ${failCount} failed`);
      } else {
        toast.error("All file uploads failed");
      }

      setIsAddModalOpen(false);
      setUploadBatch({
        typeId: "",
        listId: "",
        description: "",
        files: []
      });
      loadData();
    } catch (error) {
      console.error("Batch upload error:", error);
      toast.error("An error occurred during multi-file upload");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteEmployeeFileRecordDirectus(recordToDelete.id);
      toast.success("Document deleted successfully");
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  }

  const isSearching = searchTerm.trim().length > 0;

  const displayedRecords = records.filter(r => {
    if (isSearching) {
      return (r.record_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
             (r.type?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
             (r.list_name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    }
    return r.type === selectedFolder;
  });

  const folders = types.map(t => ({
    id: t.id.toString(),
    name: t.name,
    count: records.filter(r => r.type === t.name).length
  }));

  const uncategorizedCount = records.filter(r => !types.some(t => t.name === r.type)).length;
  if (uncategorizedCount > 0) {
      folders.push({ id: 'uncategorized', name: 'Uncategorized', count: uncategorizedCount });
  }

  const filteredLists = lists.filter(l => l.record_type_id.toString() === uploadBatch.typeId);

  return (
    <div 
      className="space-y-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search documents by name, type, or list..." 
            className="pl-9 h-10 rounded-xl bg-muted/30 border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button 
            onClick={() => {
              const typeId = types.find(t => t.name === selectedFolder)?.id?.toString() || "";
              setUploadBatch({
                typeId: typeId,
                listId: "",
                description: "",
                files: []
              });
              setIsAddModalOpen(true);
            }}
            className="h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col rounded-2xl border border-border/50 bg-card/50 overflow-hidden shadow-sm min-h-[400px]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading employee documents...</p>
          </div>
        ) : isSearching ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-border/50 bg-muted/10 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Search Results for &quot;{searchTerm}&quot;</h3>
              <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")} className="h-8 px-3 text-muted-foreground hover:text-foreground">
                Clear Search
              </Button>
            </div>
            {displayedRecords.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[25%] font-bold text-foreground">Record Name</TableHead>
                    <TableHead className="w-[15%] font-bold text-foreground">Document Type</TableHead>
                    <TableHead className="w-[30%] font-bold text-foreground">Document List</TableHead>
                    <TableHead className="w-[20%] font-bold text-foreground">Upload Date</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/20 transition-colors border-border/50">
                      <TableCell className="font-medium py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="truncate">{record.record_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="border-primary/20 text-primary/80 font-medium rounded-md px-2 py-0.5 truncate max-w-full block text-center">
                              {record.type}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{record.type}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-medium truncate block">{record.list_name}</span>
                          </TooltipTrigger>
                          <TooltipContent>{record.list_name}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {record.created_at && !isNaN(new Date(record.created_at).getTime())
                            ? formatDateTime(new Date(record.created_at)) 
                            : "---"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="Download"
                            onClick={() => {
                              const url = `/api/hrm/employee-admin/employee-master-list/assets/${record.file_ref}?filename=${encodeURIComponent(record.record_name)}`;
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = record.record_name;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete"
                            onClick={() => {
                              setRecordToDelete(record);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-20 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-4 rounded-full bg-muted/30">
                  <Search className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-foreground">No matches found</h4>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                    Try adjusting your search terms.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : !selectedFolder ? (
          <div className="p-6 flex-1">
            <h3 className="text-lg font-bold mb-6 text-foreground">Document Folders</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {folders.map(folder => (
                <div 
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.name)}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggedOverGridFolder(folder.name);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedOverGridFolder !== folder.name) {
                      setDraggedOverGridFolder(folder.name);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Only clear if leaving to something outside this card
                    const related = e.relatedTarget as Node | null;
                    if (!e.currentTarget.contains(related)) {
                      setDraggedOverGridFolder(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggedOverGridFolder(null);
                    const droppedFiles = Array.from(e.dataTransfer.files);
                    if (droppedFiles.length > 0) {
                      const largeFiles = droppedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
                      if (largeFiles.length > 0) {
                        toast.error(`Some files are too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
                      }
                      
                      const validFiles = droppedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
                      if (validFiles.length === 0) return;

                      const typeId = folder.id !== 'uncategorized' ? folder.id.toString() : "";
                      const fileItems = validFiles.map(file => ({
                        file,
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        id: Math.random().toString(36).substring(7)
                      }));
                      
                      setUploadBatch({
                        typeId: typeId,
                        listId: "",
                        description: "",
                        files: fileItems
                      });
                      setIsAddModalOpen(true);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }
                  }}
                  className={cn(
                    "relative group p-5 rounded-2xl border border-border/60 bg-background/50 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center shadow-sm hover:shadow-md overflow-hidden",
                    draggedOverGridFolder === folder.name && "border-primary ring-2 ring-primary/20 bg-primary/5"
                  )}
                >
                  {/* Invisible full-cover layer during drag to prevent children from stealing events */}
                  {draggedOverGridFolder === folder.name && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                      <div className="p-2 bg-primary/20 rounded-full animate-bounce mb-1">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-primary">Drop to Upload</span>
                    </div>
                  )}
                  <div className="p-4 rounded-2xl bg-blue-50/80 text-blue-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors dark:bg-blue-900/20 dark:text-blue-400 pointer-events-none">
                    <Folder className="h-10 w-10 fill-blue-500/20" />
                  </div>
                  <div className="pointer-events-none">
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{folder.name}</h4>
                    <p className="text-xs font-medium text-muted-foreground mt-1">{folder.count} document{folder.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div 
            className="flex-1 flex flex-col relative group transition-all duration-200"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingFolder(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingFolder(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingFolder(false);
              const droppedFiles = Array.from(e.dataTransfer.files);
              if (droppedFiles.length > 0) {
                const largeFiles = droppedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
                if (largeFiles.length > 0) {
                  toast.error(`Some files are too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
                }
                
                const validFiles = droppedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
                if (validFiles.length === 0) return;

                const typeId = types.find(t => t.name === selectedFolder)?.id?.toString() || "";
                const fileItems = validFiles.map(file => ({
                  file,
                  name: file.name.replace(/\.[^/.]+$/, ""),
                  id: Math.random().toString(36).substring(7)
                }));

                setUploadBatch({
                  typeId: typeId,
                  listId: "",
                  description: "",
                  files: fileItems
                });
                setIsAddModalOpen(true);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }
            }}
          >
            {isDraggingFolder && (
              <div className="absolute inset-x-2 inset-y-2 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-xl transition-all duration-200 fade-in zoom-in-95 animate-in pointer-events-none">
                <div className="flex flex-col items-center gap-3 p-8 bg-card rounded-2xl shadow-2xl border border-primary/20 scale-100">
                  <div className="p-4 bg-primary/10 rounded-full dark:bg-primary/20 mb-1 animate-bounce">
                     <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-xl font-bold text-foreground tracking-tight">Drop files to add</p>
                    <p className="text-sm font-medium text-muted-foreground">Uploading to <span className="text-primary font-bold">{selectedFolder}</span></p>
                  </div>
                </div>
              </div>
            )}
            <div className="p-4 border-b border-border/50 bg-muted/10 flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedFolder(null)} className="h-8 px-2 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="h-4 w-px bg-border/50"></div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold text-foreground">{selectedFolder}</h3>
                </div>
              </div>
              <Badge variant="secondary" className="font-medium">
                {displayedRecords.length} document{displayedRecords.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {displayedRecords.length > 0 ? (
              <div className="overflow-y-auto overflow-x-hidden max-h-[400px]">
                <Table className="table-fixed w-full">
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="w-[24%] font-bold text-foreground">Record Name</TableHead>
                      <TableHead className="w-[18%] font-bold text-foreground">Document Type</TableHead>
                      <TableHead className="w-[24%] font-bold text-foreground">Document List</TableHead>
                      <TableHead className="w-[22%] font-bold text-foreground">Upload Date</TableHead>
                      <TableHead className="w-[12%] text-right font-bold text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRecords.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/20 transition-colors border-border/50">
                        <TableCell className="font-medium py-4 w-[24%]">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-2 shrink-0 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                              <FileText className="h-4 w-4" />
                            </div>
                            <span className="truncate text-sm" title={record.record_name}>{record.record_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="w-[18%]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="border-primary/20 text-primary/80 font-medium rounded-md px-2 py-0.5 truncate max-w-full block text-center">
                                {record.type}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>{record.type}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="w-[24%]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-medium truncate block" title={record.list_name}>{record.list_name}</span>
                            </TooltipTrigger>
                            <TooltipContent>{record.list_name}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="w-[22%]">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {record.created_at && !isNaN(new Date(record.created_at).getTime())
                              ? formatDateTime(new Date(record.created_at)) 
                              : "---"}
                          </span>
                        </TableCell>
                        <TableCell className="w-[12%] text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Download"
                              onClick={() => {
                                const url = `/api/hrm/employee-admin/employee-master-list/assets/${record.file_ref}?filename=${encodeURIComponent(record.record_name)}`;
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = record.record_name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete"
                              onClick={() => {
                                setRecordToDelete(record);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-20 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-4 rounded-full bg-muted/30">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-foreground">Folder is empty</h4>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                    There are no documents in this folder yet.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const typeId = types.find(t => t.name === selectedFolder)?.id?.toString() || "";
                    setUploadBatch({
                      typeId: typeId,
                      listId: "",
                      description: "",
                      files: []
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="mt-2 rounded-xl border-dashed px-6"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Upload document
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog 
        open={isAddModalOpen} 
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) {
            setUploadBatch({
              typeId: "",
              listId: "",
              description: "",
              files: []
            });
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 flex-shrink-0 border-b border-border/50">
            <DialogTitle className="text-xl font-bold">Upload Document</DialogTitle>
            <DialogDescription>
              Add a new document to {user.firstName}&apos;s 201 files.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Selected Files ({uploadBatch.files.length}) <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-3 pr-2">
                {uploadBatch.files.map((fileItem, index) => (
                  <div key={fileItem.id} className="group relative bg-muted/30 rounded-xl p-3 border border-transparent hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input 
                          value={fileItem.name}
                          onChange={(e) => {
                            const newFiles = [...uploadBatch.files];
                            newFiles[index] = { ...fileItem, name: e.target.value };
                            setUploadBatch({ ...uploadBatch, files: newFiles });
                          }}
                          className="h-8 bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary/30 p-0 font-medium text-sm"
                          placeholder="Document name"
                        />
                        <p className="text-[10px] text-muted-foreground truncate">
                          {fileItem.file.name} ({(fileItem.file.size / 1024).toFixed(0)} KB)
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setUploadBatch({
                            ...uploadBatch,
                            files: uploadBatch.files.filter((_, i) => i !== index)
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {uploadBatch.files.length === 0 && (
                  <div className="text-center py-8 bg-muted/20 rounded-xl border-2 border-dashed border-muted-foreground/10 text-muted-foreground">
                    <p className="text-sm">No files selected</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Document Type <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={uploadBatch.typeId}
                onValueChange={(v) => setUploadBatch({...uploadBatch, typeId: v, listId: ""})}
              >
                <SelectTrigger className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {types.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {uploadBatch.typeId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                  Document List <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={uploadBatch.listId}
                  onValueChange={(v) => {
                    setUploadBatch({
                      ...uploadBatch, 
                      listId: v
                    });
                  }}
                >
                  <SelectTrigger className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl">
                    <SelectValue placeholder="Select document" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {filteredLists.length > 0 ? (
                      filteredLists.map(l => (
                        <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No documents for this type</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Description (Optional)
              </Label>
              <Input 
                placeholder="Brief description of the document" 
                className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl"
                value={uploadBatch.description}
                onChange={(e) => setUploadBatch({...uploadBatch, description: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                File <span className="text-red-500">*</span>
              </Label>
              <input 
                type="file" 
                className="hidden" 
                multiple
                ref={fileInputRef}
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || []);
                  if (selectedFiles.length > 0) {
                    const largeFiles = selectedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
                    if (largeFiles.length > 0) {
                      toast.error(`${largeFiles.length === 1 ? 'A file is' : 'Some files are'} too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
                    }

                    const validFiles = selectedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
                    if (validFiles.length > 0) {
                      const fileItems = validFiles.map(file => ({
                        file,
                        name: file.name.replace(/\.[[^/.]+$/, ""),
                        id: Math.random().toString(36).substring(7)
                      }));
                      setUploadBatch({ 
                        ...uploadBatch, 
                        files: [...uploadBatch.files, ...fileItems] 
                      });
                    }
                  }
                }}
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const droppedFiles = Array.from(e.dataTransfer.files);
                  if (droppedFiles.length > 0) {
                    const largeFiles = droppedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
                    if (largeFiles.length > 0) {
                      toast.error(`Some files are too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
                    }

                    const validFiles = droppedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
                    if (validFiles.length > 0) {
                      const fileItems = validFiles.map(file => ({
                        file,
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        id: Math.random().toString(36).substring(7)
                      }));
                      setUploadBatch({ 
                        ...uploadBatch, 
                        files: [...uploadBatch.files, ...fileItems] 
                      });
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer bg-muted/20 border-muted-foreground/10 hover:bg-muted/30 hover:border-primary/20",
                  isDragging && "bg-primary/20 border-primary shadow-inner"
                )}
              >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground text-center">
                    <div className="p-2 bg-primary/10 rounded-full">
                       <Plus className="h-5 w-5 text-primary opacity-80" />
                    </div>
                    {isDragging ? (
                      <span className="text-xs font-bold text-primary">Drop files here</span>
                    ) : (
                      <span className="text-xs font-medium">Add more files</span>
                    )}
                  </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 gap-2 flex-shrink-0">
            <Button 
              variant="ghost" 
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              disabled={isUploading || uploadBatch.files.length === 0 || !uploadBatch.typeId || !uploadBatch.listId}
              onClick={handleUpload}
              className="rounded-xl h-11 px-8 bg-primary hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20 min-w-[140px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading ({uploadBatch.files.length})...
                </>
              ) : (
                `Upload ${uploadBatch.files.length > 1 ? `${uploadBatch.files.length} Files` : 'File'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-full dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Delete Document</DialogTitle>
                <DialogDescription className="mt-1">
                  Are you sure you want to delete this document?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 pt-4 bg-muted/10 mx-6 mb-6 mt-4 rounded-xl border border-destructive/10">
            <p className="font-semibold text-foreground">{recordToDelete?.record_name}</p>
            <p className="text-xs text-muted-foreground mt-1">Type: {recordToDelete?.type}</p>
          </div>
          <DialogFooter className="p-6 pt-0 bg-transparent gap-2 sm:justify-end">
            <Button 
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl h-10 px-4"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="rounded-xl h-10 px-6 font-semibold"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Document"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
