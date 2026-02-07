import { createClient } from "@supabase/supabase-js";

const REMEMBER_KEY = "ll_remember_me";

const getRememberMe = () => {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw !== "false";
  } catch {
    return true;
  }
};

const getStorage = () => {
  if (typeof window === "undefined") return undefined;
  return getRememberMe() ? localStorage : sessionStorage;
};

const storage = {
  getItem: (key) => {
    try {
      const target = getStorage();
      return target ? target.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      const target = getStorage();
      if (target) target.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
};

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
