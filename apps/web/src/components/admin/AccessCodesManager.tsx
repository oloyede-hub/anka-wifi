"use client";
import { useState } from "react";
import { useAccessCodes, useDisableCode } from "@/lib/admin-operations";
import { adminError, useAdminPackages } from "@/lib/admin-management";
import { codeStatus, type AccessCode } from "@/lib/schemas/admin-operations";
import { QueryError, RowsSkeleton, StatCard, StatusBadge } from "./AdminUI";
import { AccessCodeForm } from "./AccessCodeForm";
import {
  CopyCode,
  dateTime,
  EmptyState,
  inputClass,
  OperationHeading,
  Pagination,
  primaryClass,
  Sheet,
  TableFrame,
  buttonClass,
} from "./OperationsUI";
export function AccessCodesManager() {
  const [status, setStatus] = useState("");
  const [packageId, setPackageId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const query = useAccessCodes({ status, packageId });
  const totals = useAccessCodes({ status: "", packageId: "" });
  const packages = useAdminPackages();
  const disable = useDisableCode();
  const filtered =
    query.data?.filter((item) =>
      item.code.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const rows = filtered.slice(page * 10, page * 10 + 10);
  function actions(item: AccessCode) {
    const eligible =
      item.status === "AVAILABLE" &&
      !item.reservedAt &&
      !item.reservationExpiresAt &&
      !item.soldAt;
    return (
      <Sheet
        title="Disable code"
        trigger={(open) =>
          eligible ? (
            <button
              className="text-xs font-medium text-rose-700 underline"
              onClick={() => {
                disable.reset();
                open();
              }}
            >
              Disable
            </button>
          ) : (
            <span className="text-xs text-muted">No actions</span>
          )
        }
      >
        <p className="text-sm text-muted">
          Disable {item.code}? It will no longer be available for purchase. The
          server checks that it is unused.
        </p>
        <button
          className={buttonClass}
          disabled={disable.isPending || disable.isSuccess}
          onClick={() => disable.mutate(item.id)}
        >
          {disable.isPending ? "Disabling..." : "Confirm disable"}
        </button>
        {disable.isError && (
          <p role="alert" className="text-sm text-rose-700">
            {adminError(disable.error)}
          </p>
        )}
        {disable.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            Code disabled.
          </p>
        )}
      </Sheet>
    );
  }
  return (
    <>
      <OperationHeading
        title="Access Codes"
        subtitle="Upload and manage Wi-Fi access codes for your packages."
        refreshing={query.isFetching || totals.isFetching}
        refresh={() => {
          void query.refetch();
          void totals.refetch();
        }}
      >
        <Sheet
          title="Add access code"
          trigger={(open) => (
            <button className={buttonClass} onClick={open}>
              Add code
            </button>
          )}
        >
          <AccessCodeForm bulk={false} />
        </Sheet>
        <Sheet
          title="Bulk add access codes"
          trigger={(open) => (
            <button className={primaryClass} onClick={open}>
              Bulk add codes
            </button>
          )}
        >
          <AccessCodeForm bulk />
        </Sheet>
      </OperationHeading>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {["", ...codeStatus.options].map((value, index) => (
          <StatCard
            key={value}
            label={
              value
                ? value.charAt(0) + value.slice(1).toLowerCase()
                : "Total Codes"
            }
            value={
              totals.data
                ? value
                  ? totals.data.filter((item) => item.status === value).length
                  : totals.data.length
                : "—"
            }
            detail={
              totals.isPending
                ? "Loading inventory"
                : totals.isError
                  ? "Totals unavailable"
                  : "Complete inventory"
            }
            icon={index === 0 ? "package" : "codes"}
            tone={
              value === "AVAILABLE"
                ? "green"
                : value === "RESERVED"
                  ? "amber"
                  : value === "SOLD"
                    ? "purple"
                    : "blue"
            }
          />
        ))}
      </div>
      <TableFrame>
        <h2 className="mb-4 text-lg font-bold">Access Codes</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="text-xs text-muted">
            Search code
            <input
              className={inputClass + " mt-1"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search complete loaded inventory"
              disabled={!query.data || query.isError}
            />
          </label>
          <label className="text-xs text-muted">
            Status
            <select
              className={inputClass + " mt-1"}
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All statuses</option>
              {codeStatus.options.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Package
            <select
              className={inputClass + " mt-1"}
              aria-label="Package"
              value={packageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All packages</option>
              {packages.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className={buttonClass + " self-end"}
            onClick={() => {
              setStatus("");
              setPackageId("");
              setSearch("");
              setPage(0);
            }}
          >
            Clear
          </button>
        </div>
        {packages.isError && (
          <QueryError
            error={packages.error}
            retry={() => void packages.refetch()}
          />
        )}
        {query.isPending ? (
          <RowsSkeleton />
        ) : query.isError ? (
          <>
            <QueryError
              error={query.error}
              retry={() => void query.refetch()}
            />
            {query.error instanceof Error &&
              query.error.message.startsWith("Inventory") && (
                <p className="mt-2 text-sm text-muted">{query.error.message}</p>
              )}
          </>
        ) : !rows.length ? (
          <EmptyState />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    {[
                      "Code",
                      "Package",
                      "Status",
                      "Created At",
                      "Sold At",
                      "Actions",
                    ].map((text) => (
                      <th key={text} className="px-3 py-3 font-medium">
                        {text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr className="border-b border-line" key={item.id}>
                      <td className="px-3 py-4">
                        <CopyCode code={item.code} />
                      </td>
                      <td className="px-3 py-4">{item.package.name}</td>
                      <td className="px-3 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-4 text-muted">
                        {dateTime(item.createdAt)}
                      </td>
                      <td className="px-3 py-4 text-muted">
                        {dateTime(item.soldAt)}
                      </td>
                      <td className="px-3 py-4">{actions(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {rows.map((item) => (
                <article
                  key={item.id}
                  className="space-y-3 rounded-lg border border-line p-4"
                >
                  <CopyCode code={item.code} />
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm">{item.package.name}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted">
                    Created At: {dateTime(item.createdAt)}
                    <br />
                    Sold At: {dateTime(item.soldAt)}
                  </p>
                  {actions(item)}
                </article>
              ))}
            </div>
          </>
        )}
        {!query.isError && (
          <div className="mt-4">
            <Pagination
              page={page}
              count={rows.length}
              total={query.data ? filtered.length : undefined}
              hasNext={(page + 1) * 10 < filtered.length}
              busy={query.isFetching}
              change={setPage}
            />
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Sold At records fulfillment, not first hotspot usage. Search is
          enabled only after all matching inventory has loaded.
        </p>
      </TableFrame>
    </>
  );
}
