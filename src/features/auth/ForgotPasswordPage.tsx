
import { useState, type FormEvent } from "react";
import { ArrowLeft, Mail } from "lucide-react";

import { supabase } from "@/lib/supabase";

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );

      if (resetError) {
        throw resetError;
      }

      setSent(true);
    } catch (resetError) {
      console.error("Password reset request failed:", resetError);
      setError("We could not send the reset email. Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl sm:p-9">
        <button
          type="button"
          onClick={onBack}
          className="mb-7 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-700"
        >
          <ArrowLeft size={17} />
          Back to sign in
        </button>

        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <Mail size={27} />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900">
          Reset your password
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your staff account email address. We will send you a secure password reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            If an account exists for that email address, a password reset link has been sent. Check your inbox and follow the instructions.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="reset-email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>

              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                placeholder="you@example.com"
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
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
