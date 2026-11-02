
import { useState } from "react";
import { AlertTriangle, LoaderCircle, LogOut, RefreshCw } from "lucide-react";

import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";

interface ProtectedAppProps {
  children: React.ReactNode;
}

function AuthGate({ children }: ProtectedAppProps) {
  const {
    session,
    profile,
    status,
    error,
    recoveryMode,
    signOut,
    refreshProfile,
  } = useAuth();

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const isResetPath = window.location.pathname === "/reset-password";

  if (isResetPath || recoveryMode) {
    return <ResetPasswordPage />;
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <LoaderCircle className="animate-spin text-indigo-700" size={38} />
          <p className="text-sm font-medium">Verifying your Eby-Gold account...</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle size={25} />
          </div>

          <h1 className="text-xl font-bold text-slate-900">
            Account verification failed
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error ?? "We could not verify your staff account."}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 font-bold text-white hover:bg-indigo-800"
            >
              <RefreshCw size={17} />
              Try again
            </button>

            {session && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (status === "unauthenticated" || !session || !profile) {
    if (showForgotPassword) {
      return (
        <ForgotPasswordPage
          onBack={() => setShowForgotPassword(false)}
        />
      );
    }

    return (
      <LoginPage
        onForgotPassword={() => setShowForgotPassword(true)}
      />
    );
  }

  return (
    <>
      {signOutError && (
        <div role="alert" className="fixed right-4 top-4 z-[100] rounded-xl bg-rose-100 p-3 text-sm text-rose-800 shadow-lg">
          {signOutError}
        </div>
      )}

      <div className="relative">
        <div className="fixed right-3 top-3 z-40 hidden lg:flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-800">
              {profile.full_name || profile.email}
            </p>
            <p className="text-[10px] capitalize text-slate-500">
              {profile.role}
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              setSignOutError(null);
              try {
                await signOut();
              } catch {
                setSignOutError("Unable to sign out. Please try again.");
              }
            }}
            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>

        {children}
      </div>
    </>
  );
}

export function ProtectedApp({ children }: ProtectedAppProps) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
