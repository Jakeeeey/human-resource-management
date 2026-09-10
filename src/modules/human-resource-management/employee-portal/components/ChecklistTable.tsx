"use client";

import { useRef, useState } from "react";
import type { PortalChecklistItem } from "../types/portal-checklist.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Circle, RefreshCw, Upload } from "lucide-react";

// ChecklistTable.tsx — hiree document checklist (QA §1.1 table family):
// wrapper/header, every text column capped + truncated with title,
// loading skeletons, exact colSpan on loading/empty rows, overflow-x-auto
// guard. Upload control holds `File|null` per the canon — only the
// returned UUID is persisted (never the raw file).

interface ChecklistTableProps {
  items: PortalChecklistItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  uploadingKey: string | null;
  onRefresh: () => void;
  onUpload: (docKey: string, file: File | null) => void;
}

function UploadCell({
  item,
  uploading,
  onUpload,
}: {
  item: PortalChecklistItem;
  uploading: boolean;
  onUpload: (docKey: string, file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        aria-label={`Choose file for ${item.title}`}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="min-h-8"
        title={file ? file.name : `Choose file for ${item.title}`}
      >
        <span className="max-w-[140px] truncate">
          {file ? file.name : "Choose file"}
        </span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onUpload(item.key, file);
          setFile(null);
        }}
        disabled={uploading || !file}
        aria-label={`Upload ${item.title}`}
        title={file ? `Upload ${file.name}` : "Choose a file first"}
      >
        <Upload className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ChecklistTable({
  items,
  isLoading,
  isError,
  error,
  uploadingKey,
  onRefresh,
  onUpload,
}: ChecklistTableProps) {
  const required = items.filter((item) => item.required);
  const filedRequired = required.filter((item) => item.filed).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filedRequired} of {required.length} required documents filed
        </p>
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load your checklist</AlertTitle>
          <AlertDescription>{error?.message ?? "Fetch failed"}</AlertDescription>
        </Alert>
      )}

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Upload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                      <p className="text-muted-foreground">
                        Your document checklist is not ready yet.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        HR creates your hire record first — check back soon.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell
                      className="max-w-[220px] truncate font-medium"
                      title={item.title}
                    >
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="max-w-[120px] truncate"
                        title={item.required ? "Required" : "Optional"}
                      >
                        {item.required ? "Required" : "Optional"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.filed ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          Filed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Circle className="h-4 w-4 shrink-0" />
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <UploadCell
                        item={item}
                        uploading={uploadingKey === item.key}
                        onUpload={onUpload}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
