"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
export function Sheet({
  title,
  children,
  trigger,
  onClose,
}: {
  title: string;
  children: ReactNode;
  trigger?: (open: () => void) => ReactNode;
  onClose?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  return (
    <>
      {trigger?.(() => setOpen(true))}
      <Dialog
        placement="right"
        ref={dialog}
        aria-label={title}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface p-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button
            aria-label={`Close ${title}`}
            onClick={() => dialog.current?.close()}
          >
            Close
          </Button>
        </div>
        <div className="space-y-5 p-5">{children}</div>
      </Dialog>
    </>
  );
}
