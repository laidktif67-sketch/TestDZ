export type AppStatus = "draft" | "published" | "paused" | "archived";
export type AppDistributionMethod = "none" | "play_store" | "external_link" | "apk_upload";

export interface AppRecord {
  id: string;
  developer_id: string;
  name: string;
  package_name: string;
  description: string | null;
  category: string;
  icon_url: string | null;
  distribution_method?: AppDistributionMethod;
  distribution_url?: string | null;
  status: AppStatus;
  created_at: string;
}

export interface AppLimit {
  plan_code: string;
  max_active_apps: number;
  current_active_apps: number;
  can_create: boolean;
}
