"use client";

// OnboardingHubModule.tsx — HR hub root (Todo 5). Six tabs per the plan:
// Profiles (CRUD + acceptance + status machine, live here), Orientation
// (Todo 11 body, filled) plus Verification / Training / Equipment /
// Completion shells owned by Todos 10/12-14. Module header per QA §6;
// hiree portal is Todo 9 (never rendered here — zero HR actions leak the
// other way either).

import { OnboardingProfileFetchProvider } from "./providers/profileProvider";
import { ProfilesTab } from "./components/ProfilesTab";
import { OrientationFetchProvider } from "../orientation/providers/orientationProvider";
import { OrientationTab } from "../orientation/components/OrientationTab";
import { EquipmentTab } from "../equipment/components/EquipmentTab";
import { CompletionTab } from "../completion/components/CompletionTab";
import { VerificationFetchProvider } from "../verification/providers/verificationProvider";
import { VerificationTab } from "../verification/components/VerificationTab";
import { StageTabShell } from "./components/StageTabShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck } from "lucide-react";

export function OnboardingHubModule() {
  return (
    <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-bold truncate">
            Onboarding Hub
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            HR drives hire-to-equipped onboarding from one hire record.
          </p>
        </div>
      </div>

      <OnboardingProfileFetchProvider>
        <Tabs defaultValue="profiles" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="profiles">Profiles</TabsTrigger>
              <TabsTrigger value="verification">Verification</TabsTrigger>
              <TabsTrigger value="orientation">Orientation</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="completion">Completion</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="profiles">
            <ProfilesTab />
          </TabsContent>
          <TabsContent value="verification">
            <VerificationFetchProvider>
              <VerificationTab />
            </VerificationFetchProvider>
          </TabsContent>
          <TabsContent value="orientation">
            <OrientationFetchProvider>
              <OrientationTab />
            </OrientationFetchProvider>
          </TabsContent>
          <TabsContent value="training">
            <StageTabShell
              title="Training"
              description="Assignment overview per hire; taking view over the quiz adapter."
              ownerTodo="Todo 12"
            />
          </TabsContent>
          <TabsContent value="equipment">
            <EquipmentTab />
          </TabsContent>
          <TabsContent value="completion">
            <CompletionTab />
          </TabsContent>
        </Tabs>
      </OnboardingProfileFetchProvider>
    </div>
  );
}
