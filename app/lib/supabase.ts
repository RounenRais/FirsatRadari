import { createClient } from "@supabase/supabase-js";

export type CampaignRow = {
  id: string;
  title: string;
  link: string;
  source: string;
  category: string;
  created_at: string;
};

export function createServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseKey);
}
