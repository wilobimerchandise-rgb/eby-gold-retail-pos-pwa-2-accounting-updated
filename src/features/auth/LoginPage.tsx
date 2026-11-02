
import { useState, type FormEvent } from "react";
import { Store, Eye, EyeOff, LockKeyhole } from "lucide-react";

import { supabase } from "@/lib/supabase";

interface LoginPageProps {
  onForgotPassword: () => void;
}

export function LoginPage({ onForgotPassword }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError("Incorrect email or password. Please try again.");
      }
    } catch (loginError) {
      console.error("Login failed:", loginError);
      setError("We could not complete your login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-700 text-white shadow-lg">
            <Store size={32} />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">
            Eby-Gold Superstores
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Staff sign-in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-slate-700">
              Email address
            </label>

            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-slate-700">
              Password
            </label>

            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                placeholder="Enter your password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3.5 font-bold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LockKeyhole size={18} />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Forgot your password?
          </button>
        </div>

        <p className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
          Access is restricted to authorised Eby-Gold staff.
        </p>
      </section>
    </main>
  );
}
