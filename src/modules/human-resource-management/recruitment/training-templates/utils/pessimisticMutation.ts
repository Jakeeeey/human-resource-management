import { toast } from "sonner";

// pessimisticMutation.ts — the ONE local helper for training-templates
// mutations. Every call awaits the API and only then reports success; the
// optional `undo` re-issues the inverse request behind a sonner action (never
// an optimistic local edit). Failures surface the route `message` verbatim.

function showError(err: unknown): void {
  toast.error(err instanceof Error ? err.message : "Update failed");
}

/**
 * Runs one already-started mutation and reports its outcome.
 * @param request The in-flight API promise (must already be awaited by callers).
 * @param options Success copy and the optional inverse request for Undo.
 */
export function runPessimisticMutation(
  request: Promise<unknown>,
  options: { successMessage: string; undo?: () => Promise<unknown> }
): void {
  void request
    .then(() => {
      const { undo, successMessage } = options;
      if (undo === undefined) {
        toast.success(successMessage);
        return;
      }
      toast.success(successMessage, {
        action: {
          label: "Undo",
          onClick: () => {
            void undo().then(
              () => toast.success("Change undone"),
              (err: unknown) => showError(err)
            );
          },
        },
      });
    })
    .catch(showError);
}
