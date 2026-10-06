"use client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/FormControls";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api";
import { useAdminLogin, useAdminLogout } from "@/lib/queries";
import { adminLoginSchema, type AdminLoginValues } from "@/lib/schemas/admin";
import { Icon } from "../Icon";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export function AdminLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const login = useAdminLogin();
  const logout = useAdminLogout();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });
  async function submit(values: AdminLoginValues) {
    clearErrors("root");
    try {
      await login.mutateAsync(values);
      queryClient.clear();
      router.replace("/admin");
      router.refresh();
      reset();
    } catch (error) {
      setError("root.server", {
        message:
          error instanceof ApiError && error.status === 401
            ? "Email or password is incorrect."
            : error instanceof ApiError && error.status === 429
              ? "Too many attempts. Please wait a minute before trying again."
              : "Login is temporarily unavailable. Please try again.",
      });
    }
  }
  async function signOut() {
    clearErrors("root");
    try {
      await logout.mutateAsync();
      login.reset();
      logout.reset();
      reset();
    } catch {
      setError("root.server", {
        message: "We couldn’t sign you out. Please try again.",
      });
    }
  }
  const serverError = errors.root?.server?.message;
  return (
    <section
      className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8"
      aria-labelledby="admin-login-title"
    >
      <span className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-info-soft text-brand">
        <Icon name="lock" />
      </span>
      <h1 id="admin-login-title" className="text-2xl font-bold tracking-tight">
        Admin Login
      </h1>
      {login.isSuccess ? (
        <div className="mt-5" role="status">
          <p className="text-sm text-muted">
            You’re signed in as{" "}
            <strong className="text-navy">
              {login.data.admin.name || login.data.admin.email}
            </strong>
            .
          </p>
          <Button
            variant="plain"
            size="none"
            className="mt-5 min-h-11 rounded-lg border border-line px-5 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
            type="button"
            onClick={signOut}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Signing out…" : "Sign Out"}
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            Sign in with your Anka staff credentials.
          </p>
          <form className="mt-6" onSubmit={handleSubmit(submit)} noValidate>
            <fieldset className="min-w-0" disabled={isSubmitting}>
              <label
                className="mb-1.5 block text-sm font-semibold"
                htmlFor="admin-email"
              >
                Email address
              </label>
              <Input
                className="mb-4 min-h-12"
                id="admin-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                {...register("email")}
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? "admin-email-error" : undefined
                }
              />
              {errors.email && (
                <p
                  className="-mt-2 mb-4 text-sm text-validation-strong"
                  id="admin-email-error"
                  role="alert"
                >
                  {errors.email.message}
                </p>
              )}
              <label
                className="mb-1.5 block text-sm font-semibold"
                htmlFor="admin-password"
              >
                Password
              </label>
              <Input
                className="mb-4 min-h-12"
                id="admin-password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                {...register("password")}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "admin-password-error" : undefined
                }
              />
              {errors.password && (
                <p
                  className="-mt-2 mb-4 text-sm text-validation-strong"
                  id="admin-password-error"
                  role="alert"
                >
                  {errors.password.message}
                </p>
              )}
              <Button
                variant="primary"
                size="md"
                className="min-h-12 w-full px-5 py-3"
                type="submit"
              >
                {isSubmitting ? "Signing in…" : "Sign In"}
              </Button>
            </fieldset>
          </form>
        </>
      )}
      {serverError && (
        <p
          className="mt-4 rounded-lg bg-validation-soft p-3 text-sm text-validation-deep"
          role="alert"
        >
          {serverError}
        </p>
      )}
      <Link
        className="mt-6 inline-block text-sm text-muted underline hover:text-navy"
        href="/"
      >
        Back to Anka WiFi
      </Link>
    </section>
  );
}
