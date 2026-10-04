"use client";
import { useEffect, useRef, useState } from "react";
import { useAdminPackages, useSavePackage } from "@/lib/admin-management";
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
function averagePrice(items: AdminPackage[]) {
  if (!items.length) return "—";
  const total = items.reduce((sum, item) => {
    const [whole, decimal = ""] = item.price.split(".");
    return sum + BigInt(whole) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
  }, BigInt(0));
  const count = BigInt(items.length);
  const average = (total + count / BigInt(2)) / count;
  return formatNaira(
    `${average / BigInt(100)}.${(average % BigInt(100)).toString().padStart(2, "0")}`,
  );
}
export function PackagesManager({
  startCreating = false,
}: {
  startCreating?: boolean;
}) {
  const query = useAdminPackages();
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
          className="cursor-pointer list-none rounded p-2 text-lg hover:bg-slate-100"
        >
          ⋮
        </summary>
        <div className="absolute right-0 z-10 w-40 rounded-lg border border-line bg-white p-1 shadow-lg">
          <button
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              openForm(item);
            }}
            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            disabled={changeStatus.isPending}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              void toggle(item);
            }}
            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
      </details>
    );
  }
  const filterClass =
    "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm";
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
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <AdminIcon name="plus" className="size-5" />
          Add Package
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          label="Total Packages"
          value={
            query.isPending
              ? "…"
              : query.isError || !complete
                ? "—"
                : items.length
          }
          detail={complete ? "Across all packages" : "Loading package totals"}
          icon="package"
        />
        <StatCard
          label="Active Packages"
          value={
            query.isPending
              ? "…"
              : query.isError || !complete
                ? "—"
                : items.filter((p) => p.status === "ACTIVE").length
          }
          detail="Available for customers"
          icon="check"
          tone="green"
        />
        <StatCard
          label="Inactive Packages"
          value={
            query.isPending
              ? "…"
              : query.isError || !complete
                ? "—"
                : items.filter((p) => p.status === "INACTIVE").length
          }
          detail="Not shown to customers"
          icon="pause"
          tone="amber"
        />
        <StatCard
          label="Average Price"
          value={
            query.isPending
              ? "…"
              : query.isError || !complete
                ? "—"
                : averagePrice(items)
          }
          detail="Across all packages"
          icon="tag"
          tone="purple"
        />
      </div>
      {feedback && (
        <p
          role="status"
          className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700"
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
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search packages…"
                className={filterClass + " w-full pl-10"}
              />
            </label>
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
              className={filterClass}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              aria-label="Filter type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(0);
              }}
              className={filterClass}
            >
              <option value="">All Types</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <button
              className={filterClass + " text-muted hover:bg-slate-50"}
              onClick={() => {
                setSearch("");
                setStatus("");
                setType("");
                setPage(0);
              }}
            >
              Clear
            </button>
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
                <p className="mb-3 text-sm text-amber-700">
                  Showing the first 10,000 packages. Totals are unavailable for
                  this dataset.
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
                    <button
                      onClick={() => openForm()}
                      className="mt-3 text-sm font-semibold text-brand"
                    >
                      Create Package
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto pb-20 md:block">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-muted">
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
                                className={`rounded-md px-2 py-1 text-xs ${item.type === "DAILY" ? "bg-blue-50 text-brand" : item.type === "WEEKLY" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-600"}`}
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-muted">
                  Showing {filtered.length ? page * 6 + 1 : 0} to{" "}
                  {Math.min((page + 1) * 6, filtered.length)} of{" "}
                  {filtered.length} packages
                </p>
                <div className="flex gap-2">
                  <button
                    aria-label="Previous page"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="size-9 rounded-lg border border-line text-muted disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <span className="grid size-9 place-items-center rounded-lg bg-brand text-sm text-white">
                    {page + 1}
                  </span>
                  <button
                    aria-label="Next page"
                    disabled={(page + 1) * 6 >= filtered.length}
                    onClick={() => setPage((p) => p + 1)}
                    className="size-9 rounded-lg border border-line text-muted disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        <div ref={desktopForm} className={panelClass + " hidden p-6 xl:block"}>
          <h2 className="text-lg font-bold">
            {editing ? "Edit Package" : "Create Package"}
          </h2>
          <div className="mb-5 mt-4 flex border-b border-line text-sm">
            <button
              onClick={() => openForm()}
              className={`flex-1 border-b-2 py-3 ${!editing ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}
            >
              Create New
            </button>
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
      <dialog
        ref={dialog}
        aria-labelledby="package-dialog-title"
        className="fixed m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-white p-6 shadow-xl backdrop:bg-slate-950/50"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="package-dialog-title" className="text-xl font-bold">
            {editing ? "Edit Package" : "Create Package"}
          </h2>
          <button
            onClick={() => dialog.current?.close()}
            aria-label="Close package form"
            className="rounded px-2 py-1 text-xl hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        <PackageForm
          key={(editing?.id ?? "new") + version}
          item={editing}
          onSaved={saved}
        />
      </dialog>
    </div>
  );
}
