"use client";
import { useEffect, useRef, useState } from "react";
import { useAdminPackages, useSavePackage } from "@/lib/admin-management";
import { useDashboardAnalytics } from "@/lib/admin-analytics";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Input, Select } from "@/components/ui/FormControls";
import { Dialog } from "@/components/ui/Dialog";
import type { AdminPackage } from "@/lib/schemas/admin-package";
import { formatNaira } from "@/lib/formatting";
import {
  StatCard,
  StatusBadge,
  QueryError,
  RowsSkeleton,
  panelClass,
  dateLabel,
} from "./AdminUI";
import { AdminIcon } from "./AdminIcon";
import { PackageForm } from "./PackageForm";
export function PackagesManager({
  startCreating = false,
}: {
  startCreating?: boolean;
}) {
  const query = useAdminPackages();
  const report = useDashboardAnalytics();
  const changeStatus = useSavePackage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AdminPackage>();
  const [version, setVersion] = useState(0);
  const [feedback, setFeedback] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const desktopForm = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!startCreating) return;
    if (window.matchMedia("(min-width: 1280px)").matches)
      desktopForm.current?.querySelector("input")?.focus();
    else if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [startCreating]);
  const items = query.data?.items ?? [];
  const complete = query.data?.complete ?? false;
  const filtered = items.filter(
    (p) =>
      (!status || p.status === status) &&
      (!type || p.type === type) &&
      (p.name + " " + (p.description ?? ""))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const shown = filtered.slice(page * 6, page * 6 + 6);
  function openForm(item?: AdminPackage) {
    setEditing(item);
    setVersion((v) => v + 1);
    setFeedback("");
    if (window.matchMedia("(min-width: 1280px)").matches) {
      desktopForm.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      requestAnimationFrame(() =>
        desktopForm.current?.querySelector("input")?.focus(),
      );
    } else {
      dialog.current?.showModal();
    }
  }
  function saved() {
    setFeedback(
      editing
        ? "Package updated successfully."
        : "Package created successfully.",
    );
    setEditing(undefined);
    setVersion((v) => v + 1);
    setPage(0);
    dialog.current?.close();
  }
  async function toggle(item: AdminPackage) {
    setFeedback("");
    try {
      await changeStatus.mutateAsync({
        id: item.id,
        values: { status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      });
      setFeedback(
        item.status === "ACTIVE"
          ? "Package deactivated."
          : "Package activated.",
      );
      setPage(0);
    } catch {}
  }
  function actions(item: AdminPackage) {
    return (
      <details className="relative">
        <summary
          aria-label={"Actions for " + item.name}
          className="cursor-pointer list-none rounded p-2 text-lg hover:bg-surface-soft"
        >
          ⋮
        </summary>
        <div className="absolute right-0 z-10 w-40 rounded-lg border border-line bg-surface p-1 shadow-lg">
          <Button
            variant="plain"
            size="none"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              openForm(item);
            }}
            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-muted"
          >
            Edit
          </Button>
          <Button
            variant="plain"
            size="none"
            disabled={changeStatus.isPending}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              void toggle(item);
            }}
            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
          >
            {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </details>
    );
  }
  return (
    <div className="space-y-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">
            Wi-Fi Packages
          </h1>
          <p className="mt-1 text-sm text-muted">
            Create and manage Wi-Fi packages for your customers.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => openForm()}
          className="gap-2 px-5 py-3"
        >
          <AdminIcon name="plus" className="size-5" />
          Add Package
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          label="Total Packages"
          value={
            report.data?.summaries.packages.total ??
            (report.isPending ? "\u2026" : "\u2014")
          }
          detail="Across all packages"
          icon="package"
        />
        <StatCard
          label="Active Packages"
          value={
            report.data?.summaries.packages.statuses.ACTIVE ??
            (report.isPending ? "\u2026" : "\u2014")
          }
          detail="Available for customers"
          icon="check"
          tone="green"
        />
        <StatCard
          label="Inactive Packages"
          value={
            report.data?.summaries.packages.statuses.INACTIVE ??
            (report.isPending ? "\u2026" : "\u2014")
          }
          detail="Not shown to customers"
          icon="pause"
          tone="amber"
        />
        <StatCard
          label="Average Price"
          value={
            report.data
              ? formatNaira(report.data.summaries.packages.averagePrice)
              : report.isPending
                ? "\u2026"
                : "\u2014"
          }
          detail="Across all packages"
          icon="tag"
          tone="purple"
        />
      </div>
      {report.isError && (
        <QueryError error={report.error} retry={() => void report.refetch()} />
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-lg border border-success-decoration bg-success-soft p-3 text-sm text-success"
        >
          {feedback}
        </p>
      )}
      {changeStatus.isError && (
        <QueryError
          error={changeStatus.error}
          retry={() => {
            if (changeStatus.variables)
              changeStatus.mutate(changeStatus.variables);
          }}
        />
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2.1fr)_minmax(300px,1fr)]">
        <section className={panelClass + " min-w-0 p-5 sm:p-6"}>
          <h2 className="mb-4 text-xl font-bold">All Packages</h2>
          <div className="mb-5 flex flex-wrap gap-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search packages</span>
              <AdminIcon
                name="search"
                className="absolute left-3 top-2.5 size-5 text-muted"
              />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search packages…"
                className="w-full pl-10"
              />
            </label>
            <Select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            <Select
              aria-label="Filter type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Types</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </Select>
            <Button
              variant="plain"
              size="none"
              className="text-muted"
              onClick={() => {
                setSearch("");
                setStatus("");
                setType("");
                setPage(0);
              }}
            >
              Clear
            </Button>
          </div>
          {query.isPending ? (
            <RowsSkeleton />
          ) : query.isError ? (
            <QueryError
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <>
              {!complete && (
                <p className="mb-3 text-sm text-warning">
                  Showing the first 10,000 packages. Summary totals include all
                  packages.
                </p>
              )}
              {filtered.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm text-muted">
                    {items.length
                      ? "No packages match your filters."
                      : "No Wi-Fi packages have been created yet."}
                  </p>
                  {!items.length && (
                    <Button
                      variant="plain"
                      size="none"
                      onClick={() => openForm()}
                      className="mt-3 text-sm font-semibold text-brand"
                    >
                      Create Package
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto pb-20 md:block">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-muted text-muted">
                        <tr>
                          {[
                            "Name",
                            "Type",
                            "Price",
                            "Status",
                            "Description",
                            "Created At",
                            "Actions",
                          ].map((label) => (
                            <th key={label} className="px-3 py-3 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((item) => (
                          <tr key={item.id} className="border-b border-line">
                            <td className="min-w-28 px-3 py-5 text-sm font-semibold">
                              {item.name}
                            </td>
                            <td className="px-3 py-5">
                              <span
                                className={`rounded-md px-2 py-1 text-xs ${item.type === "DAILY" ? "bg-info-soft text-brand" : item.type === "WEEKLY" ? "bg-success-soft text-success" : "bg-purple-soft text-purple"}`}
                              >
                                {item.type.charAt(0) +
                                  item.type.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-5 font-semibold">
                              {formatNaira(item.price)}
                            </td>
                            <td className="px-3 py-5">
                              <StatusBadge status={item.status} />
                            </td>
                            <td className="max-w-44 px-3 py-5 text-muted">
                              <p
                                className="line-clamp-2"
                                title={item.description ?? undefined}
                              >
                                {item.description || "—"}
                              </p>
                            </td>
                            <td className="px-3 py-5 text-muted">
                              {dateLabel(item.createdAt)}
                            </td>
                            <td className="px-3 py-5">{actions(item)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="divide-y divide-line pb-14 md:hidden">
                    {shown.map((item) => (
                      <article key={item.id} className="py-4">
                        <div className="flex justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            <p className="mt-1 text-sm text-muted">
                              {item.type.charAt(0) +
                                item.type.slice(1).toLowerCase()}{" "}
                              · {formatNaira(item.price)}
                            </p>
                          </div>
                          {actions(item)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <StatusBadge status={item.status} />
                          <span className="text-xs text-muted">
                            {dateLabel(item.createdAt)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-muted">
                          {item.description}
                        </p>
                      </article>
                    ))}
                  </div>
                </>
              )}
              <Pagination
                page={page}
                pageSize={6}
                count={shown.length}
                total={filtered.length}
                hasNext={(page + 1) * 6 < filtered.length}
                busy={query.isFetching}
                change={setPage}
              />
            </>
          )}
        </section>
        <div ref={desktopForm} className={panelClass + " hidden p-6 xl:block"}>
          <h2 className="text-lg font-bold">
            {editing ? "Edit Package" : "Create Package"}
          </h2>
          <div className="mb-5 mt-4 flex border-b border-line text-sm">
            <Button
              variant="plain"
              size="none"
              onClick={() => openForm()}
              className={`flex-1 border-b-2 py-3 ${!editing ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}
            >
              Create New
            </Button>
            <span
              className={`flex-1 border-b-2 py-3 text-center ${editing ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}
            >
              Edit Package
            </span>
          </div>
          <PackageForm
            key={(editing?.id ?? "new") + version}
            item={editing}
            onSaved={saved}
          />
        </div>
      </div>
      <Dialog
        placement="center"
        ref={dialog}
        aria-labelledby="package-dialog-title"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="package-dialog-title" className="text-xl font-bold">
            {editing ? "Edit Package" : "Create Package"}
          </h2>
          <Button
            variant="plain"
            size="none"
            onClick={() => dialog.current?.close()}
            aria-label="Close package form"
            className="rounded px-2 py-1 text-xl hover:bg-surface-soft"
          >
            ×
          </Button>
        </div>
        <PackageForm
          key={(editing?.id ?? "new") + version}
          item={editing}
          onSaved={saved}
        />
      </Dialog>
    </div>
  );
}
