"use client";
import { FeedbackCard } from "@/components/ui/FeedbackCard";
import { PaymentCard } from "@/components/payment/PaymentCard";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Input } from "@/components/ui/FormControls";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  paymentRecoverySchema,
  type PaymentRecoveryValues,
} from "@/lib/schemas/customer";
import { usePaymentVerification } from "@/lib/queries";
import { useRouter } from "next/navigation";
import { ApiError, validReference } from "@/lib/api";
import { Icon } from "../Icon";

export function PaymentStatus({ reference }: { reference: string }) {
  const verification = usePaymentVerification(reference);
  const result = verification.data;
  const state =
    verification.isFetching || verification.isPending
      ? "verifying"
      : verification.isSuccess
        ? "success"
        : "uncertain";
  const [copyMessage, setCopyMessage] = useState("");
  const paymentState =
    verification.error instanceof ApiError
      ? verification.error.paymentState
      : undefined;
  async function copy() {
    try {
      await navigator.clipboard.writeText(result!.accessCode);
      setCopyMessage("Access code copied.");
    } catch {
      setCopyMessage(
        "Couldn’t copy automatically. Select the code and copy it, or take a screenshot.",
      );
    }
  }
  if (!validReference(reference))
    return (
      <FeedbackCard>
        <h1>Check your payment</h1>
        <p>A valid payment reference is needed to confirm your payment.</p>
        <Link
          className={buttonStyles({
            variant: "primary",
            size: "lg",
            className: "shadow-action",
          })}
          href="/payment/check"
        >
          Enter Payment Reference
        </Link>
      </FeedbackCard>
    );
  return (
    <PaymentCard aria-live="polite">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-icon-soft text-brand md:size-[58px] [&_svg]:size-6 md:[&_svg]:size-[29px]">
        <Icon name={state === "success" ? "check" : "clock"} />
      </span>
      {state === "verifying" && (
        <>
          <h1>Confirming your payment...</h1>
          <p>Please wait while we check your payment securely.</p>
        </>
      )}
      {state === "success" && result && (
        <>
          <h1>You’re connected!</h1>
          <p>Your payment is confirmed. Here’s your Wi-Fi access code.</p>
          <div className="my-6 rounded-xl border border-dashed border-code-border bg-code-surface p-6 [&_small]:block [&_small]:text-[11px] [&_small]:tracking-[0.12em] [&_small]:text-muted [&_strong]:block [&_strong]:select-all [&_strong]:font-mono [&_strong]:text-[32px] [&_strong]:leading-snug [&_strong]:[overflow-wrap:anywhere]">
            <small>YOUR WI-FI ACCESS CODE</small>
            <strong>{result.accessCode}</strong>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="shadow-action"
            onClick={copy}
          >
            Copy Access Code
          </Button>
          <p role="status">{copyMessage}</p>
          <dl>
            <dt>Package</dt>
            <dd>{result.purchase.package}</dd>
            <dt>Purchase reference</dt>
            <dd>{result.purchase.reference}</dd>
            <dt>Provider</dt>
            <dd>{result.payment.provider === "OPAY" ? "OPay" : "Paystack"}</dd>
          </dl>
          <p>Save or screenshot this code before leaving this page.</p>
        </>
      )}
      {state === "uncertain" && (
        <>
          <h1>
            {paymentState === "FAILED"
              ? "Payment failed"
              : paymentState === "PENDING"
                ? "Payment pending"
                : "Payment not confirmed yet"}
          </h1>
          <p>
            We couldn’t confirm your payment or retrieve your code. Your payment
            may still be processing. Check again before making another payment.
          </p>
          <p className="mb-4 text-[13px] [overflow-wrap:anywhere]">
            Payment reference: <strong>{reference}</strong>
          </p>
          <Button
            variant="primary"
            size="lg"
            className="shadow-action"
            onClick={() => {
              void verification.refetch();
            }}
          >
            Check Again
          </Button>
          <Link
            className="inline-flex items-center gap-2.5 font-medium text-brand-dark underline mt-[15px] flex justify-center"
            href="/payment/check"
          >
            Check another payment
          </Link>
        </>
      )}
      <Link className="mt-6 block text-sm text-brand-dark underline" href="/">
        Back to Home
      </Link>
    </PaymentCard>
  );
}
export function PaymentCheck() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PaymentRecoveryValues>({
    resolver: zodResolver(paymentRecoverySchema),
    defaultValues: { reference: "" },
  });
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("anka-payment-reference");
      if (stored && !getValues("reference")) setValue("reference", stored);
    } catch {
      /* Optional convenience only. */
    }
  }, [setValue, getValues]);
  function submit(values: PaymentRecoveryValues) {
    router.push(
      `/payment/callback?reference=${encodeURIComponent(values.reference)}`,
    );
  }
  const error = errors.reference?.message;
  return (
    <PaymentCard>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-icon-soft text-brand md:size-[58px] [&_svg]:size-6 md:[&_svg]:size-[29px]">
        <Icon />
      </span>
      <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-eyebrow [&_span]:px-[7px]">
        NEED HELP?
      </p>
      <h1>Check Your Payment</h1>
      <p>
        Enter your Anka payment reference from checkout to retrieve your access
        code. Keep this reference private.
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <label
          className="mb-1.5 block text-sm font-semibold"
          htmlFor="payment-reference"
        >
          Payment reference
        </label>
        <Input
          className="mb-[18px] min-h-[47px] text-[15px]"
          id="payment-reference"
          {...register("reference")}
          aria-invalid={!!errors.reference}
          aria-describedby={error ? "reference-error" : undefined}
          required
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
        />
        {error && (
          <p
            id="reference-error"
            className="mb-4 rounded-lg bg-error-soft p-3 text-sm text-error-strong [&_a]:underline"
            role="alert"
          >
            {error}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          className="shadow-action  w-full"
          type="submit"
        >
          Check Payment
        </Button>
      </form>
      <Link className="mt-6 block text-sm text-brand-dark underline" href="/">
        Back to Home
      </Link>
    </PaymentCard>
  );
}
