"use client";

import type { SigningEnvelope } from "../../onboarding/signing/types/signing-envelope.schema";
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
import { FileSignature } from "lucide-react";

// SigningEntryTab.tsx — signing entry pre-scoped to the hiree's OWN
// envelopes (Todo 7 surface consumes the selected envelope; this tab never
// rebuilds it — pre-scope, don't rebuild). Rows arrive from the
// hiree-scoped envelopes route, so cross-hire envelopes cannot appear here
// (server 403s them before they reach the browser).

interface SigningEntryTabProps {
  envelopes: SigningEnvelope[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (envelope: SigningEnvelope) => void;
}

export function SigningEntryTab({
  envelopes,
  isLoading,
  selectedId,
  onSelect,
}: SigningEntryTabProps) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Envelope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Filed PDF</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : envelopes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <p className="text-muted-foreground">
                      No paperwork assigned to you yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      HR prepares your envelopes — they appear here to sign.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              envelopes.map((envelope) => (
                <TableRow key={envelope.id}>
                  <TableCell
                    className="max-w-[220px] truncate font-medium"
                    title={envelope.envelope_key}
                  >
                    {envelope.envelope_key}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="max-w-[140px] truncate"
                      title={envelope.status}
                    >
                      {envelope.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-[160px] truncate"
                    title={envelope.pdf_file ?? ""}
                  >
                    {envelope.pdf_file ? "Filed" : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={selectedId === envelope.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelect(envelope)}
                      disabled={envelope.status === "finished"}
                      aria-label={`Open envelope ${envelope.envelope_key} for signing`}
                      title={
                        envelope.status === "finished"
                          ? "Envelope is locked"
                          : "Open in the signing surface"
                      }
                    >
                      <FileSignature className="mr-2 h-4 w-4" />
                      {envelope.status === "finished" ? "Locked" : "Sign"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
