import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kxqaugxtokfwbckqfeob.supabase.co";

const supabaseAnonKey = "sb_publishable_83PayxnHZGMoys0X7lPbmQ_oRCa64w4";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
