"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Loader2, 
  AlertCircle,
  FolderOpen,
  CheckCircle2
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
  TooltipProvider,
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
  const [filterType, setFilterType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<EmployeeFileRecordDisplay | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for new record
  const [newRecord, setNewRecord] = useState({
    name: "",
    typeId: "",
    listId: "",
    description: "",
    file: null as File | null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

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
    if (!newRecord.file || !newRecord.name || !newRecord.typeId || !newRecord.listId) {
        toast.error("Please fill in all required fields");
        return;
    }

    setIsUploading(true);
    try {
      // 1. Upload file to Directus
      let fileId = "";
      const file = newRecord.file;
      
      // Compress if image, otherwise upload raw
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
      // We'll use type=employee_file which we'll map to the target folder in the route
      const res = await fetch(`${UPLOAD_API}?type=employee_file`, { method: "POST", body: fd });
      
      if (!res.ok) throw new Error("File upload failed");
      const json = await res.json();
      fileId = json?.data?.id;
      
      if (!fileId) throw new Error("Directus did not return a file ID");

      // 2. Create record in Spring Boot (list_id is actually the type's ID in this context if we don't have a separate checklist list)
      // For now, let's assume list_id refers to the record_type or a specific list entry.
      // For now, let's assume list_id refers to the record_type or a specific list entry.
      // We'll use the newly added listId from the dropdown
      
      await createEmployeeFileRecordDirectus({
        user_id: user.id,
        list_id: Number(newRecord.listId),
        record_name: newRecord.name,
        description: newRecord.description,
        file_ref: fileId
      });

      toast.success("File uploaded successfully");
      setIsAddModalOpen(false);
      setNewRecord({
        name: "",
        typeId: "",
        listId: "",
        description: "",
        file: null
      });
      loadData();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
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

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      (r.record_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (r.type?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (r.list_name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      
    const matchesType = filterType === "all" || r.type === filterType;

    return matchesSearch && matchesType;
  });

  const filteredLists = lists.filter(l => l.record_type_id.toString() === newRecord.typeId);

  return (
    <div className="space-y-6">
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
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 w-full sm:w-[180px] rounded-xl bg-muted/30 border-none">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All Types" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Types</SelectItem>
              {types.map(t => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading employee documents...</p>
          </div>
        ) : filteredRecords.length > 0 ? (
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
              {filteredRecords.map((record) => (
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
                        onClick={() => window.open(`/api/hrm/employee-admin/employee-master-list/assets/${record.file_ref}`, '_blank')}
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
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">No documents found</h4>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                {searchTerm 
                  ? `No matching records for "${searchTerm}"`
                  : "Upload employee 201 files such as contracts, IDs, and clearances."
                }
              </p>
            </div>
            {!searchTerm && (
              <Button 
                variant="outline" 
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 rounded-xl border-dashed px-6"
              >
                Start uploading
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">Upload Document</DialogTitle>
            <DialogDescription>
              Add a new document to {user.firstName}&apos;s 201 files.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Document Name <span className="text-red-500">*</span>
              </Label>
              <Input 
                placeholder="e.g. Employment Contract 2024" 
                className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl"
                value={newRecord.name}
                onChange={(e) => setNewRecord({...newRecord, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Document Type <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={newRecord.typeId}
                onValueChange={(v) => setNewRecord({...newRecord, typeId: v, listId: ""})}
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

            {newRecord.typeId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                  Document List <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={newRecord.listId}
                  onValueChange={(v) => {
                    const selectedList = filteredLists.find(l => l.id.toString() === v);
                    setNewRecord({
                      ...newRecord, 
                      listId: v,
                      // Optionally auto-populate the name if it's currently empty
                      name: newRecord.name || (selectedList?.name || "")
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
                value={newRecord.description}
                onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                File <span className="text-red-500">*</span>
              </Label>
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => setNewRecord({...newRecord, file: e.target.files?.[0] || null})}
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer",
                  newRecord.file 
                    ? "bg-primary/5 border-primary/30" 
                    : "bg-muted/20 border-muted-foreground/10 hover:bg-muted/30 hover:border-primary/20"
                )}
              >
                {newRecord.file ? (
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <CheckCircle2 className="h-8 w-8" />
                    <span className="text-sm font-semibold truncate max-w-[200px]">{newRecord.file.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewRecord({...newRecord, file: null});
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Plus className="h-8 w-8 opacity-40" />
                    <span className="text-sm font-medium">Click to select file</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">PDF, JPG, PNG, DOCX</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              disabled={isUploading || !newRecord.file || !newRecord.name || !newRecord.typeId || !newRecord.listId}
              onClick={handleUpload}
              className="rounded-xl h-11 px-8 bg-primary hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20 min-w-[140px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload File"
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
