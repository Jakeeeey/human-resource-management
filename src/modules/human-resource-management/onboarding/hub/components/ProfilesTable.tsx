"use client";

import type { OnboardingProfile } from "../types/onboarding-profile.schema";
import { STATUS_ORDER } from "../statusMachine";
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
import { ArrowRight, CheckCircle2, Pencil } from "lucide-react";

// ProfilesTable.tsx — manual table family (6 columns): wrapper/header per
// QA §1.1, every text column capped + truncated with title, loading skeletons,
// exact colSpan=6 on loading/empty rows, overflow-x-auto guard.

interface ProfilesTableProps {
  profiles: OnboardingProfile[];
  isLoading: boolean;
  onEdit: (profile: OnboardingProfile) => void;
  onAdvance: (profile: OnboardingProfile) => void;
  onAccept: (profile: OnboardingProfile) => void;
}

export function ProfilesTable({
  profiles,
  isLoading,
  onEdit,
  onAdvance,
  onAccept,
}: ProfilesTableProps) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <p className="text-muted-foreground">
                      No onboarding profiles found.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New hires appear here automatically via the Master List
                      hook, or create one manually.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => {
                const isLast =
                  STATUS_ORDER.indexOf(profile.status) ===
                  STATUS_ORDER.length - 1;
                return (
                  <TableRow key={profile.id}>
                    <TableCell
                      className="max-w-[160px] truncate font-medium"
                      title={String(profile.employee_id)}
                    >
                      #{profile.employee_id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="max-w-[200px] truncate"
                        title={profile.status}
                      >
                        {profile.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {profile.offer_accepted ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          Accepted
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[160px] truncate"
                      title={profile.start_date ?? ""}
                    >
                      {profile.start_date ?? "—"}
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate"
                      title={profile.updated_at ?? ""}
                    >
                      {profile.updated_at ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!profile.offer_accepted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAccept(profile)}
                            aria-label={`Record offer acceptance for employee ${profile.employee_id}`}
                            title="Record offer acceptance"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {!isLast && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAdvance(profile)}
                            aria-label={`Advance employee ${profile.employee_id} to next stage`}
                            title="Advance to next stage"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(profile)}
                          aria-label={`Edit employee ${profile.employee_id}`}
                          title="Edit profile"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
