
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getOrCreateDeviceId } from "@/lib/device-identity";

export interface AuthProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string;
  branch_id: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  session: Session | null;
  profile: AuthProfile | null;
  status: AuthStatus;
  error: string | null;
  recoveryMode: boolean;
  deviceId: string | null;
  deviceIdentityError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceIdentityError, setDeviceIdentityError] = useState<string | null>(
    null
  );

  const loadProfile = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setProfile(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    setStatus("loading");
    setError(null);

    const { data, error: profileError } = await supabase
      .from("users")
      .select("id, email, full_name, role, organization_id, branch_id")
      .eq("id", currentSession.user.id)
      .maybeSingle();

    if (profileError) {
      setProfile(null);
      setStatus("error");
      setError("We could not load your staff profile. Please contact the owner.");
      console.error("Profile loading failed:", profileError);
      return;
    }

    if (!data) {
      setProfile(null);
      setStatus("error");
      setError("Your account has no staff profile. Please contact the owner.");
      return;
    }

    setProfile({
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      organization_id: data.organization_id,
      branch_id: data.branch_id,
    });

    setStatus("authenticated");
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      setStatus("error");
      setError("Unable to verify your login session.");
      return;
    }

    setSession(data.session);
    await loadProfile(data.session);
  }, [loadProfile]);

  useEffect(() => {
    try {
      const currentDeviceId = getOrCreateDeviceId();

      setDeviceId(currentDeviceId);
      setDeviceIdentityError(null);
    } catch (deviceError) {
      setDeviceId(null);

      setDeviceIdentityError(
        deviceError instanceof Error
          ? deviceError.message
          : "Unable to initialize this POS device identity."
      );

      console.error("Device identity initialization failed:", deviceError);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let requestNumber = 0;

    const applySession = async (nextSession: Session | null) => {
      const currentRequest = ++requestNumber;

      if (!active) {
        return;
      }

      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setStatus("unauthenticated");
        setError(null);
        setRecoveryMode(false);
        return;
      }

      setStatus("loading");

      const { data, error: profileError } = await supabase
        .from("users")
        .select("id, email, full_name, role, organization_id, branch_id")
        .eq("id", nextSession.user.id)
        .maybeSingle();

      if (!active || currentRequest !== requestNumber) {
        return;
      }

      if (profileError) {
        setProfile(null);
        setStatus("error");
        setError("We could not load your staff profile. Please contact the owner.");
        console.error("Profile loading failed:", profileError);
        return;
      }

      if (!data) {
        setProfile(null);
        setStatus("error");
        setError("Your account has no staff profile. Please contact the owner.");
        return;
      }

      setProfile({
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        organization_id: data.organization_id,
        branch_id: data.branch_id,
      });

      setStatus("authenticated");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }

      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
      }

      void applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) {
        return;
      }

      if (sessionError) {
        setStatus("error");
        setError("Unable to verify your login session.");
        return;
      }

      void applySession(data.session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw signOutError;
    }

    setSession(null);
    setProfile(null);
    setRecoveryMode(false);
    setStatus("unauthenticated");
  }, []);

  const value: AuthContextValue = {
    session,
    profile,
    status,
    error,
    recoveryMode,
    deviceId,
    deviceIdentityError,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
