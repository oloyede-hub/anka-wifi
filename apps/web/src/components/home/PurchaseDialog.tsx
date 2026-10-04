"use client";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutSchema, type CheckoutValues } from "@/lib/schemas/customer";
import { useCreatePurchase, useInitializePayment } from "@/lib/queries";
import { ApiError, type WifiPackage } from "@/lib/api";
import { formatNaira } from "@/lib/formatting";

export function PurchaseDialog({
  wifiPackage,
  onClose,
}: {
  wifiPackage: WifiPackage;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const purchase = useCreatePurchase();
  const payment = useInitializePayment();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { phone: "", email: "" },
  });
  const busy = isSubmitting;
  const reference = purchase.data?.reference;
  const error = errors.root?.server?.message;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    element?.querySelector<HTMLInputElement>("input")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  async function submit(values: CheckoutValues) {
    if (locked.current) return;
    locked.current = true;
    clearErrors("root");
    try {
      const purchaseReference =
        reference ||
        (
          await purchase.mutateAsync({
            packageId: wifiPackage.id,
            phone: values.phone,
            email: values.email,
          })
        ).reference;
      const initialized = await payment.mutateAsync(purchaseReference);
      const url = new URL(initialized.authorizationUrl);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("Invalid authorization URL");
      // Recovery is keyed by the random payment reference, never phone/email.
      try {
        sessionStorage.setItem(
          "anka-payment-reference",
          initialized.paymentReference,
        );
      } catch {
        /* Storage may be unavailable. */
      }
      window.location.assign(url.href);
    } catch (cause) {
      setError("root.server", {
        message:
          cause instanceof ApiError && cause.status === 409
            ? "This plan may no longer be available or your payment may need checking. Please check your payment before starting again."
            : "We couldn’t start payment. Try again, or check your payment if you already paid.",
      });
      locked.current = false;
    }
  }
  return (
    <dialog
      ref={dialog}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[480px] overflow-auto rounded-[20px] border border-line bg-white px-[22px] py-7 text-navy shadow-[0_30px_90px_#07153430] backdrop:bg-navy/40 backdrop:backdrop-blur-sm md:p-8 [&_h2]:pr-4 [&_h2]:text-[27px] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-tight"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <button
        className="absolute top-3 right-3.5 size-9 cursor-pointer rounded-full bg-[#f0f4fa] text-[25px] disabled:cursor-wait disabled:opacity-60"
        type="button"
        aria-label="Close checkout"
        disabled={busy}
        onClick={onClose}
      >
        ×
      </button>
      <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#607394] [&_span]:px-[7px]">
        ONE STEP CLOSER
      </p>
      <h2 id="checkout-title">Complete your purchase</h2>
      <div className="my-[22px] flex flex-wrap items-center justify-between gap-[15px] rounded-[10px] bg-[#f2f7ff] p-4 md:flex-nowrap [&_span]:text-[22px] [&_span]:font-bold">
        <strong>{wifiPackage.name}</strong>
        <span>{formatNaira(String(wifiPackage.price))}</span>
      </div>
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <fieldset className="min-w-0 border-0 p-0" disabled={busy}>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="phone">
            Phone number
          </label>
          <input
            className="mb-[18px] block min-h-[47px] w-full rounded-lg border border-[#c5d0e1] bg-white px-3 py-2.5 text-navy disabled:bg-[#f3f5f8]"
            id="phone"
            {...register("phone")}
            readOnly={!!reference}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            type="tel"
            autoComplete="tel"
            placeholder="e.g. 08012345678"
            maxLength={25}
            required
            autoFocus
          />
          {errors.phone && (
            <p
              id="phone-error"
              role="alert"
              className="-mt-3 mb-4 text-sm text-red-700"
            >
              {errors.phone.message}
            </p>
          )}
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="email">
            Email address
          </label>
          <input
            className="mb-[18px] block min-h-[47px] w-full rounded-lg border border-[#c5d0e1] bg-white px-3 py-2.5 text-navy disabled:bg-[#f3f5f8]"
            id="email"
            {...register("email")}
            readOnly={!!reference}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={254}
            required
          />
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="-mt-3 mb-4 text-sm text-red-700"
            >
              {errors.email.message}
            </p>
          )}
        </fieldset>
        {reference && (
          <p className="mb-4 text-[13px] [overflow-wrap:anywhere]">
            Purchase reference: <strong>{reference}</strong>
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-[#fff3ee] p-3 text-sm text-[#913515] [&_a]:underline"
          >
            {error} <a href="/payment/check">Check Payment</a>
          </p>
        )}
        <button
          className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark w-full"
          type="submit"
          disabled={busy}
        >
          {busy ? "Preparing secure payment…" : "Continue to Payment"}
        </button>
        <p className="mt-3 text-center text-xs text-muted" role="status">
          You’ll continue to Paystack to complete your payment securely.
        </p>
      </form>
    </dialog>
  );
}
