"use client";

import { GraduationCap } from "lucide-react";

import { TrainingTakingModule } from "@/modules/human-resource-management/onboarding/training";
import { usePortalFetch } from "@/modules/human-resource-management/employee-portal/providers/portalProvider";

// TrainingSection.tsx — hiree training entry in the employee portal (todo 31).
// Mounts the EXISTING `TrainingTakingModule` with the POST-HIRE employee
// principal (`user.user_id` from the server-resolved portal session). An
// APPLICANT (pre-hire) has no `user_id` yet, so training renders only once the
// hire exists — the module itself is untouched; this file only exposes it to
// the hiree path. The portal never passes an HR actor, so no HR action leaks
// here (and vice versa).

export function TrainingSection(): React.ReactNode {
  const { session } = usePortalFetch();
  const userId = session?.user_id ?? null;

  if (!session || userId === null) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl shrink-0">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold truncate">Training</h2>
          <p className="text-sm text-muted-foreground">
            Quizzes assigned to you after your hire.
          </p>
        </div>
      </div>
      <TrainingTakingModule
        actor={{ user_id: userId, role: "hiree" }}
        scope={{ userId }}
      />
    </section>
  );
}
