"use client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/FormControls";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  packageFormSchema,
  type PackageFormValues,
  type AdminPackage,
} from "@/lib/schemas/admin-package";
import { useSavePackage, adminError } from "@/lib/admin-management";
export function PackageForm({
  item,
  onSaved,
}: {
  item?: AdminPackage;
  onSaved: () => void;
}) {
  const save = useSavePackage();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    reset,
    setValue,
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: item
      ? {
          name: item.name,
          type: item.type,
          price: item.price,
          description: item.description ?? "",
          status: item.status,
        }
      : {
          name: "",
          type: "DAILY",
          price: "",
          description: "",
          status: "ACTIVE",
        },
  });
  async function submit(values: PackageFormValues) {
    try {
      await save.mutateAsync({ id: item?.id, values });
      reset();
      onSaved();
    } catch {}
  }
  const type = useWatch({ control, name: "type" });
  const status = useWatch({ control, name: "status" });
  const description = useWatch({ control, name: "description" });
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      <fieldset disabled={isSubmitting} className="space-y-5">
        <label className="block text-sm font-medium">
          Package Name <span className="text-validation">*</span>
          <Input
            {...register("name")}
            autoComplete="off"
            maxLength={120}
            placeholder="e.g. 3 Days Access"
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <span role="alert" className="mt-1 block text-xs text-validation">
              {errors.name.message}
            </span>
          )}
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Package Type <span className="text-validation">*</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-sm ${type === value ? "border-brand bg-info-soft text-brand" : "border-control-strong"}`}
              >
                <span>{value.charAt(0) + value.slice(1).toLowerCase()}</span>
                <Input
                  type="radio"
                  value={value}
                  {...register("type")}
                  className="size-4 accent-brand"
                />
              </label>
            ))}
          </div>
          {errors.type && (
            <p role="alert" className="text-xs text-validation">
              {errors.type.message}
            </p>
          )}
        </fieldset>
        <label className="block text-sm font-medium">
          Price (₦) <span className="text-validation">*</span>
          <Input
            {...register("price")}
            inputMode="decimal"
            placeholder="e.g. 1200"
            aria-invalid={!!errors.price}
          />
          {errors.price && (
            <span role="alert" className="mt-1 block text-xs text-validation">
              {errors.price.message}
            </span>
          )}
        </label>
        <label className="block text-sm font-medium">
          Description
          <Textarea
            {...register("description")}
            rows={4}
            maxLength={2000}
            placeholder="Describe this package (optional)"
            aria-invalid={!!errors.description}
            className={" resize-y"}
          />
          <span className="mt-1 block text-right text-xs font-normal text-muted">
            {description.length}/2000
          </span>
          {errors.description && (
            <span role="alert" className="block text-xs text-validation">
              {errors.description.message}
            </span>
          )}
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Status</legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Input
              type="checkbox"
              role="switch"
              checked={status === "ACTIVE"}
              onChange={(event) =>
                setValue(
                  "status",
                  event.target.checked ? "ACTIVE" : "INACTIVE",
                  { shouldDirty: true },
                )
              }
              className="peer sr-only"
            />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-surface-decoration transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-surface after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
            <span>
              {status === "ACTIVE"
                ? "Active (available for customers)"
                : "Inactive (hidden from customers)"}
            </span>
          </label>
          <p className="mt-2 text-xs text-muted">
            Inactive packages will not be shown to customers.
          </p>
        </fieldset>
      </fieldset>
      {save.isError && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-3 text-sm text-danger-deep"
        >
          {adminError(save.error)}
        </p>
      )}
      <Button
        variant="primary"
        size="md"
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 w-full px-4 py-3"
      >
        {isSubmitting ? "Saving…" : item ? "Save Changes" : "Create Package"}
      </Button>
    </form>
  );
}
