
import { useState, type FormEvent } from "react";
import { LockKeyhole, CheckCircle2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";

export function ResetPasswordPage() {
  const { session, status } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setUpdated(true);
      setPassword("");
      setConfirmPassword("");
    } catch (updateError) {
      console.error("Password update failed:", updateError);
      setError("We could not update your password. The reset link may have expired. Request a new one and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-medium text-slate-500">
          Verifying your password reset link...
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-slate-900">
            Reset link unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            This link may have expired or already been used. Return to sign in and request another password reset link.
          </p>

          <a
            href="/"
            className="mt-6 inline-flex rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white hover:bg-indigo-800"
          >
            Return to sign in
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl sm:p-9">
        {updated ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={34} />
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900">
              Password updated
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your password has been changed successfully. Continue to your Eby-Gold dashboard.
            </p>

            <a
              href="/"
              className="mt-7 inline-flex w-full justify-center rounded-xl bg-indigo-700 px-4 py-3.5 font-bold text-white hover:bg-indigo-800"
            >
              Continue to Eby-Gold
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <LockKeyhole size={27} />
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900">
              Choose a new password
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Use at least 8 characters.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-slate-700">
                  New password
                </label>

                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm new password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-indigo-700 px-4 py-3.5 font-bold text-white hover:bg-indigo-800 disabled:opacity-60"
              >
                {loading ? "Updating password..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
