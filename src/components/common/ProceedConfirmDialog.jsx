import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function useProceedConfirm() {
  const resolverRef = useRef(null);
  const [prompt, setPrompt] = useState(null);

  const ask = useCallback((next) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPrompt(next);
    });
  }, []);

  const close = (accepted) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPrompt(null);
    if (resolve) resolve(accepted);
  };

  const dialog = (
    <AlertDialog
      open={Boolean(prompt)}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent className="z-[300] border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {prompt?.title || "Confirm before you continue"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                Review this before posting. Continue only if the entry is
                intentional.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {(prompt?.lines || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              close(true);
            }}
            className="bg-[var(--aa-accent)] text-white hover:opacity-90"
          >
            Yes, continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
