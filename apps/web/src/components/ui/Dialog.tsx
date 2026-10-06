import type { ComponentPropsWithRef } from "react";

const placements = {
  center:
    "m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[480px] rounded-dialog border border-line bg-surface p-6 text-navy shadow-dialog backdrop:bg-navy/40 backdrop:backdrop-blur-sm md:p-8",
  right:
    "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-full border-0 bg-surface p-0 text-navy shadow-2xl backdrop:bg-modal-shade/40 sm:w-[470px]",
  left: "fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-sidebar p-0 text-on-dark backdrop:bg-modal-shade/50",
};
// The owning flow controls showModal/close and cancellation. Native dialog retains
// focus trapping, Escape handling and focus restoration without a second modal system.
export function Dialog({
  placement = "center",
  className = "",
  ...props
}: ComponentPropsWithRef<"dialog"> & { placement?: keyof typeof placements }) {
  return (
    <dialog
      {...props}
      className={["overflow-y-auto", placements[placement], className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
