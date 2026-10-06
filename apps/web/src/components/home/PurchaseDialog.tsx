"use client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/FormControls";
import { Dialog } from "@/components/ui/Dialog";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutSchema, type CheckoutValues } from "@/lib/schemas/customer";
import { useCreatePurchase, useInitializePayment } from "@/lib/queries";
import { ApiError, type WifiPackage, type CheckoutProvider } from "@/lib/api";
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
  const [provider, setProvider] = useState<CheckoutProvider>("PAYSTACK");
  const [attemptReference, setAttemptReference] = useState<string>();
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
      const initialized = await payment.mutateAsync({
        purchaseReference,
        provider,
      });
      setAttemptReference(initialized.paymentReference);
      const url = new URL(initialized.authorizationUrl);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("Invalid authorization URL");
      if (
        initialized.provider === "OPAY" &&
        !(
          url.hostname === "opaycheckout.com" ||
          url.hostname.endsWith(".opaycheckout.com")
        )
      )
        throw new Error("Invalid OPay authorization URL");
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
      if (cause instanceof ApiError && cause.paymentReference) {
        setAttemptReference(cause.paymentReference);
        try {
          sessionStorage.setItem(
            "anka-payment-reference",
            cause.paymentReference,
          );
        } catch {
          /* Optional convenience. */
        }
      }
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
    <Dialog
      placement="center"
      ref={dialog}
      className="[&_h2]:pr-4 [&_h2]:text-[27px] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-tight"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <Button
        variant="plain"
        size="none"
        className="absolute top-3 right-3.5 size-9 cursor-pointer rounded-full bg-surface-close text-[25px] disabled:cursor-wait disabled:opacity-60"
        type="button"
        aria-label="Close checkout"
        disabled={busy}
        onClick={onClose}
      >
        ×
      </Button>
      <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-eyebrow [&_span]:px-[7px]">
        ONE STEP CLOSER
      </p>
      <h2 id="checkout-title">Complete your purchase</h2>
      <div className="my-[22px] flex flex-wrap items-center justify-between gap-[15px] rounded-[10px] bg-surface-selection p-4 md:flex-nowrap [&_span]:text-[22px] [&_span]:font-bold">
        <strong>{wifiPackage.name}</strong>
        <span>{formatNaira(String(wifiPackage.price))}</span>
      </div>
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <fieldset className="min-w-0 border-0 p-0" disabled={busy}>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="phone">
            Phone number
          </label>
          <Input
            className="mb-[18px] min-h-[47px] text-[15px]"
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
              className="-mt-3 mb-4 text-sm text-validation-strong"
            >
              {errors.phone.message}
            </p>
          )}
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="email">
            Email address
          </label>
          <Input
            className="mb-[18px] min-h-[47px] text-[15px]"
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
              className="-mt-3 mb-4 text-sm text-validation-strong"
            >
              {errors.email.message}
            </p>
          )}
        </fieldset>
        <fieldset
          className="mb-5 min-w-0"
          disabled={busy || !!attemptReference}
        >
          <legend className="mb-2 text-sm font-semibold">
            Choose payment provider
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["PAYSTACK", "OPAY"] as const).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${provider === value ? "border-brand bg-info-soft" : "border-line"}`}
              >
                <Input
                  type="radio"
                  name="provider"
                  value={value}
                  checked={provider === value}
                  onChange={() => setProvider(value)}
                  className="mt-1 accent-brand"
                />
                <span>
                  <strong className="block text-sm">
                    {value === "OPAY" ? "OPay" : "Paystack"}
                  </strong>
                  <span className="text-xs text-muted">
                    {value === "OPAY"
                      ? "Pay with OPay checkout"
                      : "Card, bank or transfer"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {reference && (
          <p className="mb-4 text-[13px] [overflow-wrap:anywhere]">
            Purchase reference: <strong>{reference}</strong>
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-error-soft p-3 text-sm text-error-strong [&_a]:underline"
          >
            {error} <a href="/payment/check">Check Payment</a>
          </p>
        )}
        {attemptReference && (
          <p className="mb-4 text-sm [overflow-wrap:anywhere]">
            Payment reference: <strong>{attemptReference}</strong>.{" "}
            <a
              className="text-brand underline"
              href={`/payment/callback?reference=${encodeURIComponent(attemptReference)}`}
            >
              Check this payment
            </a>{" "}
            before starting again.
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          className="shadow-action  w-full"
          type="submit"
          disabled={busy || !!attemptReference}
        >
          {busy ? "Preparing secure payment…" : "Continue to Payment"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted" role="status">
          You’ll continue to {provider === "OPAY" ? "OPay" : "Paystack"} to
          complete your payment securely.
        </p>
      </form>
    </Dialog>
  );
}
