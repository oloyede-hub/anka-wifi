"use client";
import { useState } from "react";
import { usePayment, usePurchase } from "@/lib/admin-operations";
import { formatNaira } from "@/lib/formatting";
import { QueryError, RowsSkeleton, StatusBadge } from "./AdminUI";
import { CopyCode, DataPanel, dateTime, Field, Sheet } from "./OperationsUI";
import type { AdminPurchase } from "@/lib/schemas/admin-operations";
export function PurchaseRelationships({
  purchase,
}: {
  purchase: AdminPurchase;
}) {
  return (
    <>
      <DataPanel title="Package">
        <Field label="Name">{purchase.package.name}</Field>
        <Field label="Type">{purchase.package.type}</Field>
      </DataPanel>
      <DataPanel title="Customer">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone number">{purchase.customer.phone}</Field>
          <Field label="Email address">{purchase.customer.email}</Field>
        </div>
      </DataPanel>
    </>
  );
}
function PurchaseDetails({ reference }: { reference: string }) {
  const query = usePurchase(reference);
  if (!reference) return null;
  if (query.isPending) return <RowsSkeleton />;
  if (query.isError)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data;
  return (
    <>
      <DataPanel title="Purchase">
        <Field label="Reference">{item.reference}</Field>
        <StatusBadge status={item.status} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount">{formatNaira(item.amount)}</Field>
          <Field label="Created At">{dateTime(item.createdAt)}</Field>
          <Field label="Completed At">{dateTime(item.completedAt)}</Field>
        </div>
      </DataPanel>
      <PurchaseRelationships purchase={item} />
      <DataPanel title={`Payment attempts (${item.payment.length})`}>
        {item.payment.length === 0 ? (
          <p className="text-sm text-muted">No payment attempts recorded.</p>
        ) : (
          [...item.payment]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((attempt) => (
              <article
                key={attempt.reference}
                className="space-y-3 rounded-lg border border-line p-3"
              >
                <Field label="Payment reference">{attempt.reference}</Field>
                <StatusBadge status={attempt.status} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount">
                    {attempt.currency === "NGN"
                      ? formatNaira(attempt.amount)
                      : `${attempt.currency} ${attempt.amount}`}
                  </Field>
                  <Field label="Provider">{attempt.provider}</Field>
                  <Field label="Created At">
                    {dateTime(attempt.createdAt)}
                  </Field>
                  <Field label="Paid At">{dateTime(attempt.paidAt)}</Field>
                </div>
              </article>
            ))
        )}
      </DataPanel>
      <DataPanel title="Access Code">
        {item.accessCode ? (
          <>
            <CopyCode code={item.accessCode.code} />
            <StatusBadge status={item.accessCode.status} />
            <Field label="Sold At">{dateTime(item.accessCode.soldAt)}</Field>
          </>
        ) : (
          <p className="text-sm text-muted">No access code assigned.</p>
        )}
      </DataPanel>
    </>
  );
}
function PaymentDetails({ reference }: { reference: string }) {
  const query = usePayment(reference);
  const purchase = usePurchase(query.data?.purchase.reference ?? "");
  if (!reference) return null;
  if (query.isPending) return <RowsSkeleton />;
  if (query.isError)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data;
  return (
    <>
      <DataPanel title="Payment attempt">
        <Field label="Reference">{item.reference}</Field>
        <StatusBadge status={item.status} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount">
            {item.currency === "NGN"
              ? formatNaira(item.amount)
              : `${item.currency} ${item.amount}`}
          </Field>
          <Field label="Provider">{item.provider}</Field>
          <Field label="Created At">{dateTime(item.createdAt)}</Field>
          <Field label="Paid At">{dateTime(item.paidAt)}</Field>
        </div>
      </DataPanel>
      <DataPanel title="Purchase">
        <Field label="Purchase reference">{item.purchase.reference}</Field>
        <StatusBadge status={item.purchase.status} />
        {purchase.data && (
          <Field label="Purchase amount">
            {formatNaira(purchase.data.amount)}
          </Field>
        )}
      </DataPanel>
      {purchase.isPending ? (
        <RowsSkeleton />
      ) : purchase.isError ? (
        <QueryError
          error={purchase.error}
          retry={() => void purchase.refetch()}
        />
      ) : (
        <PurchaseRelationships purchase={purchase.data} />
      )}
      <p className="text-xs text-muted">
        Provider transaction IDs and dashboard URLs are not returned by the API.
      </p>
    </>
  );
}
export function DetailButton({
  kind,
  reference,
  label,
}: {
  kind: "purchases" | "payments";
  reference: string;
  label?: string;
}) {
  const [selected, setSelected] = useState("");
  return (
    <Sheet
      title={kind === "purchases" ? "Purchase Details" : "Payment Details"}
      onClose={() => setSelected("")}
      trigger={(open) => (
        <button
          className="break-all text-left font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
          onClick={() => {
            setSelected(reference);
            open();
          }}
        >
          {label ?? reference}
        </button>
      )}
    >
      {kind === "purchases" ? (
        <PurchaseDetails reference={selected} />
      ) : (
        <PaymentDetails reference={selected} />
      )}
    </Sheet>
  );
}
