"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addCodeSchema,
  bulkCodeFormSchema,
} from "@/lib/schemas/admin-operations";
import { useAddCodes } from "@/lib/admin-operations";
import { adminError, useAdminPackages } from "@/lib/admin-management";
import { inputClass, primaryClass } from "./OperationsUI";
import { QueryError } from "./AdminUI";
export function AccessCodeForm({ bulk }: { bulk: boolean }) {
  const packages = useAdminPackages();
  const mutation = useAddCodes(bulk);
  const form = useForm<z.infer<typeof bulkCodeFormSchema>>({
    resolver: zodResolver(bulkCodeFormSchema),
    defaultValues: { packageId: "", text: "" },
  });
  const single = useForm<z.infer<typeof addCodeSchema>>({
    resolver: zodResolver(addCodeSchema),
    defaultValues: { packageId: "", code: "" },
  });
  const result = mutation.data;
  if (packages.isError)
    return (
      <QueryError
        error={packages.error}
        retry={() => void packages.refetch()}
      />
    );
  const options = (
    <>
      <option value="">Choose a package</option>
      {packages.data?.items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} ({item.status.toLowerCase()})
        </option>
      ))}
    </>
  );
  const feedback = (
    <>
      <p role="alert" className="text-sm text-rose-700">
        {mutation.isError ? adminError(mutation.error) : ""}
      </p>
      {mutation.isSuccess && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {result
            ? `Created ${result.created} of ${result.requested}. Skipped ${result.skipped}: ${result.duplicatesInRequest} duplicates in entry, ${result.alreadyStored} already stored.`
            : "Code added successfully."}
        </p>
      )}
    </>
  );
  return bulk ? (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        mutation.reset();
        try {
          await mutation.mutateAsync({
            packageId: values.packageId,
            codes: values.text.split(/\r?\n/).filter((line) => line.length > 0),
          });
          form.reset({ packageId: values.packageId, text: "" });
        } catch {}
      })}
    >
      <p className="text-sm text-muted">
        Add existing hotspot codes, one per line. Up to 1,000 codes per
        submission. Empty lines are ignored; whitespace inside codes is
        rejected.
      </p>
      <label className="block text-sm">
        Package
        <select
          aria-label="Package"
          className={inputClass + " mt-2"}
          disabled={packages.isPending || mutation.isPending}
          {...form.register("packageId")}
        >
          {options}
        </select>
      </label>
      <p role="alert" className="text-xs text-rose-700">
        {form.formState.errors.packageId?.message}
      </p>
      <label className="block text-sm">
        Codes
        <textarea
          rows={10}
          className={inputClass + " mt-2 font-mono"}
          {...form.register("text")}
          disabled={mutation.isPending}
        />
      </label>
      <p role="alert" className="text-xs text-rose-700">
        {form.formState.errors.text?.message}
      </p>
      {feedback}
      <button
        className={primaryClass + " w-full"}
        disabled={packages.isPending || mutation.isPending}
      >
        {mutation.isPending ? "Adding..." : "Add codes"}
      </button>
    </form>
  ) : (
    <form
      className="space-y-4"
      onSubmit={single.handleSubmit(async (values) => {
        mutation.reset();
        try {
          await mutation.mutateAsync(values);
          single.reset({ packageId: values.packageId, code: "" });
        } catch {}
      })}
    >
      <p className="text-sm text-muted">
        Enter an existing code from the hotspot system. The backend assigns its
        initial status.
      </p>
      <label className="block text-sm">
        Package
        <select
          aria-label="Package"
          className={inputClass + " mt-2"}
          disabled={packages.isPending || mutation.isPending}
          {...single.register("packageId")}
        >
          {options}
        </select>
      </label>
      <p role="alert" className="text-xs text-rose-700">
        {single.formState.errors.packageId?.message}
      </p>
      <label className="block text-sm">
        Access code
        <input
          className={inputClass + " mt-2 font-mono"}
          {...single.register("code")}
          disabled={mutation.isPending}
          autoComplete="off"
        />
      </label>
      <p role="alert" className="text-xs text-rose-700">
        {single.formState.errors.code?.message}
      </p>
      {feedback}
      <button
        className={primaryClass + " w-full"}
        disabled={packages.isPending || mutation.isPending}
      >
        {mutation.isPending ? "Adding..." : "Add code"}
      </button>
    </form>
  );
}
