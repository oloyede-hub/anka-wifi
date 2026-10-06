"use client";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/FormControls";

import { useState } from "react";
import { PAGE_SIZE, useOperationList } from "@/lib/admin-operations";
import {
  paymentStatus,
  purchaseStatus,
  type AdminPurchase,
  type AdminPayment,
} from "@/lib/schemas/admin-operations";
import { useDashboardAnalytics } from "@/lib/admin-analytics";
import { formatNaira } from "@/lib/formatting";
import {
  QueryError,
  RowsSkeleton,
  StatusBadge,
  ProviderBadge,
} from "./AdminUI";
import { DistributionCard, MoneyAreaCard } from "./DashboardCharts";
import { DetailButton } from "./OperationDetails";
import {
  dateTime,
  EmptyState,
  OperationHeading,
  StatusTabs,
  TableFrame,
  DataSummary,
} from "./OperationsUI";
function Attempts({ item }: { item: AdminPurchase }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">
        {item.payment.length} attempt{item.payment.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap gap-1">
        {[...new Set(item.payment.map((p) => p.status))].map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    </div>
  );
}
export function TransactionsManager({
  kind,
}: {
  kind: "purchases" | "payments";
}) {
  const purchases = kind === "purchases";
  const title = purchases ? "Purchases" : "Payments";
  const statuses = purchases ? purchaseStatus.options : paymentStatus.options;
  const [status, setStatus] = useState("");
  const [searchField, setSearchField] = useState(
    purchases ? "reference" : "purchaseReference",
  );
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filters: Record<string, string> = { status, [searchField]: search };
  const query = useOperationList(kind, filters, page);
  const report = useDashboardAnalytics();
  const rows = query.data?.slice(0, PAGE_SIZE) ?? [];
  const heads = purchases
    ? [
        "Reference",
        "Package",
        "Customer",
        "Amount",
        "Payment attempts",
        "Purchase status",
        "Date",
        "Actions",
      ]
    : [
        "Reference",
        "Amount",
        "Provider",
        "Status",
        "Purchase",
        "Created At",
        "Paid At",
        "Actions",
      ];
  function changeStatus(value: string) {
    setStatus(value);
    setPage(0);
  }
  return (
    <>
      <OperationHeading
        title={title}
        subtitle={
          purchases
            ? "View customer Wi-Fi purchases and their payment status."
            : "Track payment transactions for Wi-Fi purchases."
        }
        refreshing={query.isFetching || report.isFetching}
        refresh={() => {
          void query.refetch();
          void report.refetch();
        }}
      />
      <DataSummary title={title} statuses={statuses} resource={kind} />
      {!purchases && (
        <div className="mb-5 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <MoneyAreaCard kind="paymentVolume" />
          <DistributionCard kind="paymentStatus" />
        </div>
      )}
      <TableFrame>
        <StatusTabs statuses={statuses} value={status} change={changeStatus} />
        <form
          className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_2fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(text.trim());
            setPage(0);
          }}
        >
          <label className="text-xs text-muted">
            Search by
            <Select
              className={" mt-1"}
              aria-label="Search by"
              value={searchField}
              onChange={(e) => {
                setSearchField(e.target.value);
                setText("");
                setSearch("");
                setPage(0);
              }}
            >
              {purchases ? (
                <>
                  <option value="reference">Purchase reference (exact)</option>
                  <option value="phone">Customer phone (exact)</option>
                </>
              ) : (
                <option value="purchaseReference">
                  Purchase reference (exact)
                </option>
              )}
            </Select>
          </label>
          <label className="text-xs text-muted">
            {searchField === "phone" ? "Phone number" : "Purchase reference"}
            <Input
              className={" mt-1"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={searchField === "phone" ? 16 : 128}
              placeholder="Enter an exact value"
            />
          </label>
          <Button variant="secondary" size="md" className={" self-end"}>
            Search
          </Button>
          <Button
            variant="secondary"
            size="md"
            type="button"
            className={" self-end"}
            onClick={() => {
              setStatus("");
              setText("");
              setSearch("");
              setPage(0);
            }}
          >
            Clear
          </Button>
        </form>
        <p className="mb-4 text-xs text-muted">
          {purchases
            ? "Search supports exact purchase reference or phone. Package, email and date filters are not available in the API."
            : "Search supports exact purchase reference. Customer, package, date and payment-reference filters are not available in the list API."}{" "}
          Dates use Africa/Lagos time.
        </p>
        {query.isPending ? (
          <RowsSkeleton />
        ) : query.isError ? (
          <QueryError error={query.error} retry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">{title} results</caption>
                <thead className="bg-surface-muted text-muted">
                  <tr>
                    {heads.map((head) => (
                      <th key={head} className="px-3 py-3 font-medium">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) =>
                    purchases ? (
                      <PurchaseRow
                        key={row.reference}
                        item={row as AdminPurchase}
                      />
                    ) : (
                      <PaymentRow
                        key={row.reference}
                        item={row as AdminPayment}
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <article
                  key={row.reference}
                  className="space-y-3 rounded-lg border border-line p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <DetailButton kind={kind} reference={row.reference} />
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="font-semibold">
                    {"currency" in row && row.currency !== "NGN"
                      ? `${row.currency} ${row.amount}`
                      : formatNaira(row.amount)}
                  </p>
                  {"customer" in row ? (
                    <>
                      <p className="text-sm">{row.package.name}</p>
                      <p className="break-words text-xs text-muted">
                        {row.customer.phone}
                        <br />
                        {row.customer.email}
                      </p>
                      <Attempts item={row} />
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted">
                        Provider: <ProviderBadge provider={row.provider} />
                      </p>
                      <p className="break-all text-xs text-muted">
                        Provider Reference:{" "}
                        {row.providerReference ?? "Not recorded"}
                      </p>
                      <DetailButton
                        kind="purchases"
                        reference={row.purchase.reference}
                        label={`Purchase: ${row.purchase.reference}`}
                      />
                      <p className="text-xs text-muted">
                        Paid At: {dateTime(row.paidAt)}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted">
                    Created At: {dateTime(row.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
        {!query.isError && (
          <div className="mt-4">
            <Pagination
              maxPage={10000}
              page={page}
              count={rows.length}
              hasNext={(query.data?.length ?? 0) > PAGE_SIZE}
              busy={query.isFetching}
              change={setPage}
            />
          </div>
        )}
      </TableFrame>
    </>
  );
}
function PurchaseRow({ item }: { item: AdminPurchase }) {
  return (
    <tr className="border-b border-line">
      <td className="max-w-44 px-3 py-4">
        <DetailButton kind="purchases" reference={item.reference} />
      </td>
      <td className="px-3 py-4">
        {item.package.name}
        <p className="mt-1 text-[10px] text-muted">{item.package.type}</p>
      </td>
      <td className="px-3 py-4">
        {item.customer.phone}
        <p className="mt-1 break-all text-muted">{item.customer.email}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-4 font-medium">
        {formatNaira(item.amount)}
      </td>
      <td className="px-3 py-4">
        <Attempts item={item} />
      </td>
      <td className="px-3 py-4">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-3 py-4 text-muted">{dateTime(item.createdAt)}</td>
      <td className="px-3 py-4">
        <DetailButton
          kind="purchases"
          reference={item.reference}
          label="Details"
        />
      </td>
    </tr>
  );
}
function PaymentRow({ item }: { item: AdminPayment }) {
  return (
    <tr className="border-b border-line">
      <td className="max-w-44 px-3 py-4">
        <DetailButton kind="payments" reference={item.reference} />
      </td>
      <td className="whitespace-nowrap px-3 py-4 font-medium">
        {item.currency === "NGN"
          ? formatNaira(item.amount)
          : `${item.currency} ${item.amount}`}
      </td>
      <td className="max-w-48 px-3 py-4 text-muted">
        <ProviderBadge provider={item.provider} />
        <p className="mt-2 break-all text-xs">
          Provider Reference: {item.providerReference ?? "Not recorded"}
        </p>
      </td>
      <td className="px-3 py-4">
        <StatusBadge status={item.status} />
      </td>
      <td className="max-w-44 px-3 py-4">
        <DetailButton kind="purchases" reference={item.purchase.reference} />
      </td>
      <td className="px-3 py-4 text-muted">{dateTime(item.createdAt)}</td>
      <td className="px-3 py-4 text-muted">{dateTime(item.paidAt)}</td>
      <td className="px-3 py-4">
        <DetailButton
          kind="payments"
          reference={item.reference}
          label="Details"
        />
      </td>
    </tr>
  );
}
