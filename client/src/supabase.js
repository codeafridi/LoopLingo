import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);
// #region agent log

// #endregion

console.log("Supabase URL:", process.env.REACT_APP_SUPABASE_URL);
console.log("Supabase Anon Key:", process.env.REACT_APP_SUPABASE_ANON_KEY);
