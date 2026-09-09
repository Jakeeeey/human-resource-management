"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// StageTabShell.tsx — placeholder shell for the role/lifecycle tabs whose
// bodies belong to later todos (10-13 build on these shells + the machine
// predicates). HR-only; the hiree portal is Todo 9 and lives elsewhere.

interface StageTabShellProps {
  title: string;
  description: string;
  ownerTodo: string;
}

export function StageTabShell({
  title,
  description,
  ownerTodo,
}: StageTabShellProps) {
  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="max-w-[300px] truncate" title={title}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This surface lands in {ownerTodo}; the status machine already gates
          its stage transitions.
        </p>
      </CardContent>
    </Card>
  );
}
