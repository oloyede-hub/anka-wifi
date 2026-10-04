"use client";
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
import { validReference } from "@/lib/api";
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
      <div className="rounded-xl border border-line bg-[#f8fbff] p-9 text-center [&_h1]:my-4 [&_h1]:text-[32px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h3]:text-xl [&_h3]:font-bold [&_p]:mt-3 [&_p]:mb-5 [&_p]:text-muted [&>svg]:mx-auto [&>svg]:mb-4 [&>svg]:text-brand">
        <h1>Check your payment</h1>
        <p>A valid payment reference is needed to confirm your payment.</p>
        <Link
          className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark"
          href="/payment/check"
        >
          Enter Payment Reference
        </Link>
      </div>
    );
  return (
    <div
      className="w-full max-w-[540px] rounded-[20px] border border-line bg-white px-5 py-[26px] text-center shadow-[0_10px_35px_#162a490c] md:p-9 [&_h1]:mt-[18px] [&_h1]:mb-3.5 [&_h1]:text-[28px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h1]:tracking-tight md:[&_h1]:text-[32px] [&_p]:mb-5 [&_p:not([role=alert])]:text-muted [&_form]:mt-[26px] [&_form]:text-left [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-1 [&_dl]:gap-[5px] [&_dl]:text-left [&_dl]:text-sm md:[&_dl]:grid-cols-[120px_1fr] md:[&_dl]:gap-3 [&_dt]:text-muted [&_dd]:mb-3 [&_dd]:font-semibold [&_dd]:[overflow-wrap:anywhere] md:[&_dd]:mb-0"
      aria-live="polite"
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-brand md:size-[58px] [&_svg]:size-6 md:[&_svg]:size-[29px]">
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
          <div className="my-6 rounded-xl border border-dashed border-[#b0caff] bg-[#edf5ff] p-6 [&_small]:block [&_small]:text-[11px] [&_small]:tracking-[0.12em] [&_small]:text-muted [&_strong]:block [&_strong]:select-all [&_strong]:font-mono [&_strong]:text-[32px] [&_strong]:leading-snug [&_strong]:[overflow-wrap:anywhere]">
            <small>YOUR WI-FI ACCESS CODE</small>
            <strong>{result.accessCode}</strong>
          </div>
          <button
            className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark"
            onClick={copy}
          >
            Copy Access Code
          </button>
          <p role="status">{copyMessage}</p>
          <dl>
            <dt>Package</dt>
            <dd>{result.purchase.package}</dd>
            <dt>Purchase reference</dt>
            <dd>{result.purchase.reference}</dd>
          </dl>
          <p>Save or screenshot this code before leaving this page.</p>
        </>
      )}
      {state === "uncertain" && (
        <>
          <h1>Payment not confirmed yet</h1>
          <p>
            We couldn’t confirm your payment or retrieve your code. Your payment
            may still be processing. Check again before making another payment.
          </p>
          <p className="mb-4 text-[13px] [overflow-wrap:anywhere]">
            Payment reference: <strong>{reference}</strong>
          </p>
          <button
            className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark"
            onClick={() => {
              void verification.refetch();
            }}
          >
            Check Again
          </button>
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
    </div>
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
    <div className="w-full max-w-[540px] rounded-[20px] border border-line bg-white px-5 py-[26px] text-center shadow-[0_10px_35px_#162a490c] md:p-9 [&_h1]:mt-[18px] [&_h1]:mb-3.5 [&_h1]:text-[28px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h1]:tracking-tight md:[&_h1]:text-[32px] [&_p]:mb-5 [&_p:not([role=alert])]:text-muted [&_form]:mt-[26px] [&_form]:text-left [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-1 [&_dl]:gap-[5px] [&_dl]:text-left [&_dl]:text-sm md:[&_dl]:grid-cols-[120px_1fr] md:[&_dl]:gap-3 [&_dt]:text-muted [&_dd]:mb-3 [&_dd]:font-semibold [&_dd]:[overflow-wrap:anywhere] md:[&_dd]:mb-0">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-brand md:size-[58px] [&_svg]:size-6 md:[&_svg]:size-[29px]">
        <Icon />
      </span>
      <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#607394] [&_span]:px-[7px]">
        NEED HELP?
      </p>
      <h1>Check Your Payment</h1>
      <p>
        Enter the payment reference from your Paystack receipt or checkout to
        retrieve your access code. Keep this reference private.
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <label
          className="mb-1.5 block text-sm font-semibold"
          htmlFor="payment-reference"
        >
          Payment reference
        </label>
        <input
          className="mb-[18px] block min-h-[47px] w-full rounded-lg border border-[#c5d0e1] bg-white px-3 py-2.5 text-navy disabled:bg-[#f3f5f8]"
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
            className="mb-4 rounded-lg bg-[#fff3ee] p-3 text-sm text-[#913515] [&_a]:underline"
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark w-full"
          type="submit"
        >
          Check Payment
        </button>
      </form>
      <Link className="mt-6 block text-sm text-brand-dark underline" href="/">
        Back to Home
      </Link>
    </div>
  );
}
