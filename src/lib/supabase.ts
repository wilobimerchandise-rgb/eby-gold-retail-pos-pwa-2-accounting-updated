
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable.");
}

const REMEMBER_ME_KEY = "eby-gold-remember-me";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;

function readRememberPreference(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) !== "false";
  } catch {
    return true;
  }
}

export function getRememberMePreference(): boolean {
  return readRememberPreference();
}

/**
 * Changes the session storage mode.
 * Clear both copies of the current project's auth token so an old
 * session cannot unexpectedly reappear after switching modes.
 */
export function setRememberMePreference(remember: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, String(remember));
    window.localStorage.removeItem(authStorageKey);
    window.sessionStorage.removeItem(authStorageKey);
  } catch (error) {
    console.error("Could not update Remember me preference:", error);
    throw new Error("Could not update your session preference.");
  }
}

/**
 * Supabase session storage:
 * - Remember me enabled: localStorage
 * - Remember me disabled: sessionStorage
 */
const authStorage = {
  getItem(key: string): string | null {
    try {
      return readRememberPreference()
        ? window.localStorage.getItem(key)
        : window.sessionStorage.getItem(key);
    } catch (error) {
      console.error("Could not read the authentication session:", error);
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (readRememberPreference()) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error("Could not save the authentication session:", error);
      throw error;
    }
  },

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch (error) {
      console.error("Could not remove the authentication session:", error);
      throw error;
    }
  },
};

/**
 * EbyGold POS Supabase client.
 *
 * Used for authentication, PostgreSQL access,
 * realtime updates and cloud synchronization.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
