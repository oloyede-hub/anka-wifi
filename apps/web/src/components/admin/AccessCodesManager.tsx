"use client";
import { Sheet } from "@/components/ui/Sheet";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/FormControls";

import { useDashboardAnalytics } from "@/lib/admin-analytics";
import { useState } from "react";
import { useAccessCodes, useDisableCode } from "@/lib/admin-operations";
import { adminError, useAdminPackages } from "@/lib/admin-management";
import { codeStatus, type AccessCode } from "@/lib/schemas/admin-operations";
import { QueryError, RowsSkeleton, StatusBadge } from "./AdminUI";
import { AccessCodeForm } from "./AccessCodeForm";
import {
  CopyCode,
  DataSummary,
  dateTime,
  EmptyState,
  OperationHeading,
  TableFrame,
} from "./OperationsUI";
export function AccessCodesManager() {
  const [status, setStatus] = useState("");
  const [packageId, setPackageId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const query = useAccessCodes({ status, packageId });
  const totals = useDashboardAnalytics();
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
            <Button
              variant="plain"
              size="none"
              className="text-xs font-medium text-danger-deep underline"
              onClick={() => {
                disable.reset();
                open();
              }}
            >
              Disable
            </Button>
          ) : (
            <span className="text-xs text-muted">No actions</span>
          )
        }
      >
        <p className="text-sm text-muted">
          Disable {item.code}? It will no longer be available for purchase. The
          server checks that it is unused.
        </p>
        <Button
          variant="secondary"
          size="md"

          disabled={disable.isPending || disable.isSuccess}
          onClick={() => disable.mutate(item.id)}
        >
          {disable.isPending ? "Disabling..." : "Confirm disable"}
        </Button>
        {disable.isError && (
          <p role="alert" className="text-sm text-danger-deep">
            {adminError(disable.error)}
          </p>
        )}
        {disable.isSuccess && (
          <p role="status" className="text-sm text-success-strong">
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
            <Button variant="secondary" size="md" onClick={open}>
              Add code
            </Button>
          )}
        >
          <AccessCodeForm bulk={false} />
        </Sheet>
        <Sheet
          title="Bulk add access codes"
          trigger={(open) => (
            <Button variant="primary" size="md" onClick={open}>
              Bulk add codes
            </Button>
          )}
        >
          <AccessCodeForm bulk />
        </Sheet>
      </OperationHeading>
      <DataSummary title="Codes" statuses={codeStatus.options} resource="accessCodes" />
      <TableFrame>
        <h2 className="mb-4 text-lg font-bold">Access Codes</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="text-xs text-muted">
            Search code
            <Input
              className={" mt-1"}
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
            <Select
              className={" mt-1"}
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
            </Select>
          </label>
          <label className="text-xs text-muted">
            Package
            <Select
              className={" mt-1"}
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
            </Select>
          </label>
          <Button
            variant="secondary"
            size="md"
            className={" self-end"}
            onClick={() => {
              setStatus("");
              setPackageId("");
              setSearch("");
              setPage(0);
            }}
          >
            Clear
          </Button>
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
                <thead className="bg-surface-muted text-muted">
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
