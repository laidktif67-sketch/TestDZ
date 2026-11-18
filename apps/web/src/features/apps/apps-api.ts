import type { AppLimit, AppRecord } from "@testdz/types";
import { supabase } from "../../lib/supabase";
import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";

const APP_SELECT = "id,developer_id,name,package_name,description,category,icon_url,status,created_at";

function client() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

function dataClient(): any {
  return getAppDataClient();
}

/** Read the current user's applications using the existing RLS policies. */
export function listApps(developerId: string) {
  return dataClient().from("apps").select(APP_SELECT).eq("developer_id", developerId).order("created_at", { ascending: false });
}

/** Read the current plan's application limit through the existing RPC. */
export function getAppLimit() {
  return dataClient().rpc("get_app_limit");
}

/** Read one application; access remains enforced by the existing RLS policies. */
export function getAppById(id: string, developerId: string) {
  return dataClient().from("apps").select(APP_SELECT).eq("id", id).eq("developer_id", developerId).single();
}

/** Create an application through the existing server-side RPC. */
export function createApp(input: {
  name: string;
  packageName: string;
  description: string;
  category: string;
}) {
  return dataClient().rpc("create_app", {
    p_name: input.name,
    p_package_name: input.packageName,
    p_description: input.description,
    p_category: input.category,
  });
}

/** Update application metadata through the existing server-side RPC. */
export function updateApp(input: {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
}) {
  return dataClient().rpc("update_app", {
    p_app_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    ...(input.iconUrl === undefined ? {} : { p_icon_url: input.iconUrl }),
  });
}

/** Upload an icon to the public bucket; Storage policies restrict writes to the app owner. */
export async function uploadAppIcon(userId: string, appId: string, file: File, metadata: { name: string; description: string; category: string }) {
  const storage = client().storage;
  const extension = file.type === "image/png" ? "png" : "jpg";
  const path = isTesterWorkflowV2Enabled
    ? "v2/" + userId + "/" + appId + "/icon." + extension
    : userId + "/" + appId + "/icon." + extension;
  const upload = await storage.from("app-icons").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (upload.error) return { uploadError: upload.error, updateError: null };
  const { data } = storage.from("app-icons").getPublicUrl(path);
  const { error: updateError } = await updateApp({
    id: appId,
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    iconUrl: data.publicUrl,
  });
  return { uploadError: null, updateError };
}

/** Archive an application through the existing server-side RPC. */
export function archiveApp(id: string) {
  return dataClient().rpc("archive_app", { p_app_id: id });
}

/** Restore an archived application through the existing server-side RPC. */
export function restoreApp(id: string) {
  return dataClient().rpc("restore_app", { p_app_id: id });
}

export type { AppLimit, AppRecord };


export interface DeveloperTestInput {
  appId: string;
  title: string;
  description: string;
  shortSummary?: string | null;
  testType: "google_play_closed" | "apk_testing" | "bug_discovery" | "usability" | "compatibility" | "custom";
  minTesters: number;
  startDate?: string | null;
  endDate?: string | null;
  durationMinutes?: number | null;
  instructions?: string | null;
}

export function listDeveloperTests(developerId: string) {
  return dataClient().from("tests")
    .select("id,app_id,developer_id,title,description,short_summary,test_type,status,min_testers,start_date,end_date,estimated_duration_minutes,created_at")
    .eq("developer_id", developerId)
    .order("created_at", { ascending: false });
}

export type DeveloperTestMonitoringSummary = {
  test: {
    id: string; title: string; description: string | null; shortSummary: string | null;
    testType: string; status: string; minTesters: number; startDate: string | null;
    endDate: string | null; durationMinutes: number | null; instructions: string | null;
    appName: string; appIconUrl: string | null;
  };
  configuration: Record<string, unknown>;
  metrics: {
    totalAssignments: number; uniqueTesters: number; pending: number; active: number;
    completed: number; failed: number; withdrawn: number; rejected: number;
    completionRate: number; checkins: number; feedbackCount: number;
    averageRating: number | null; ratingCount: number; feedbackPending: number; feedbackAccepted: number; feedbackRejected: number;
  };
  dailyActivity: Array<{ date: string; count: number }>;
};

/** Fetch aggregate-only monitoring metrics for a developer-owned test. */
export function getDeveloperTestMonitoringSummary(testId: string) {
  return dataClient().rpc("get_developer_test_monitoring", { p_test_id: testId });
}

export function createDeveloperTest(input: DeveloperTestInput) {
  return dataClient().rpc("create_test", {
    p_app_id: input.appId,
    p_title: input.title,
    p_description: input.description,
    p_short_summary: input.shortSummary ?? null,
    p_test_type: input.testType,
    p_min_testers: input.minTesters,
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_duration: input.durationMinutes ?? null,
    p_instructions: input.instructions ?? null,
  });
}

export function updateDeveloperTest(testId: string, input: Omit<DeveloperTestInput, "appId">) {
  return dataClient().rpc("update_test", {
    p_test_id: testId,
    p_title: input.title,
    p_description: input.description,
    p_short_summary: input.shortSummary ?? null,
    p_test_type: input.testType,
    p_min_testers: input.minTesters,
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_duration: input.durationMinutes ?? null,
    p_instructions: input.instructions ?? null,
  });
}

export interface DeveloperTestStepInput {
  title: string;
  description: string;
  isRequired: boolean;
}

export interface DeveloperTestRequirementInput {
  type: "device" | "android_version" | "account" | "network" | "eligibility" | "other";
  title: string;
  description: string;
  isMandatory: boolean;
}

/** Replace a draft test's ordered steps and requirements atomically through an owner-checked RPC. */
export function saveDeveloperTestContent(
  testId: string,
  steps: DeveloperTestStepInput[],
  requirements: DeveloperTestRequirementInput[],
) {
  return dataClient().rpc("save_test_content", {
    p_test_id: testId,
    p_steps: steps,
    p_requirements: requirements,
  });
}

export function submitDeveloperTestForReview(testId: string) {
  return dataClient().rpc("submit_test_for_review", { p_test_id: testId });
}

export function createDeveloperTestCohort(input: {
  testId: string; name: string; capacity: number; startsAt?: string | null; endsAt?: string | null;
}) {
  return dataClient().rpc("create_test_cohort", {
    p_test_id: input.testId,
    p_name: input.name,
    p_capacity: input.capacity,
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
  });
}

export interface DeveloperCohort {
  id: string;
  test_id: string;
  name: string;
  capacity: number;
  status: "forming" | "ready" | "running" | "completed" | "cancelled";
  starts_at: string | null;
  ends_at: string | null;
}

export async function listDeveloperCohorts(developerId: string) {
  const result = await dataClient().from("cohort_tests")
    .select("test_id,cohort_id,cohorts!inner(id,name,capacity,status,starts_at,ends_at,created_by)")
    .eq("developer_id", developerId);
  if (result.error) return { data: null, error: result.error };
  const rows = (result.data ?? []) as unknown as Array<{
    test_id: string;
    cohorts: Omit<DeveloperCohort, "test_id"> & { created_by: string };
  }>;
  return {
    data: rows.filter(row => row.cohorts.created_by === developerId)
      .map(row => ({ ...row.cohorts, test_id: row.test_id })) as DeveloperCohort[],
    error: null,
  };
}

export function updateDeveloperTestCohort(input: {
  cohortId: string; name: string; capacity: number; startsAt?: string | null; endsAt?: string | null; reason: string;
}) {
  return dataClient().rpc("update_test_cohort", {
    p_cohort_id: input.cohortId,
    p_name: input.name,
    p_capacity: input.capacity,
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
    p_reason: input.reason,
  });
}

export function transitionDeveloperTestCohort(cohortId: string, status: "ready" | "running" | "completed" | "cancelled", reason: string) {
  return dataClient().rpc("transition_test_cohort", {
    p_cohort_id: cohortId,
    p_new_status: status,
    p_reason: reason,
  });
}

export interface DeveloperTestBuild {
  id: string;
  test_id: string;
  file_id: string;
  version_label: string;
  original_filename: string;
  size_bytes: number;
  status: "pending" | "uploaded";
  uploaded_at: string | null;
  created_at: string;
}

export function listDeveloperTestBuilds(developerId: string) {
  return dataClient().from("test_builds")
    .select("id,test_id,file_id,version_label,original_filename,size_bytes,status,uploaded_at,created_at")
    .eq("developer_id", developerId)
    .order("created_at", { ascending: false });
}

/** Register metadata first, upload to the private bucket, then verify the stored object server-side. */
export async function uploadDeveloperTestBuild(input: {
  userId: string;
  testId: string;
  file: File;
  versionLabel: string;
  fileId: string;
}) {
  const mime = "application/vnd.android.package-archive";
  if (!input.file.name.toLowerCase().endsWith(".apk") || input.file.type !== mime) {
    return { error: new Error("APK_FILE_TYPE_INVALID"), stage: "validation" as const };
  }
  if (input.file.size < 1 || input.file.size > 52428800) {
    return { error: new Error("APK_FILE_SIZE_INVALID"), stage: "validation" as const };
  }
  const { data: path, error: registerError } = await dataClient().rpc("register_test_build", {
    p_test_id: input.testId,
    p_file_id: input.fileId,
    p_version_label: input.versionLabel,
    p_original_filename: input.file.name,
    p_size_bytes: input.file.size,
    p_sha256: null,
  });
  if (registerError || !path) return { error: registerError ?? new Error("APK_REGISTRATION_FAILED"), stage: "registration" as const };
  const { data: build, error: lookupError } = await dataClient().from("test_builds")
    .select("id").eq("test_id", input.testId).eq("developer_id", input.userId).eq("storage_path", path).single();
  if (lookupError || !build) return { error: lookupError ?? new Error("APK_BUILD_LOOKUP_FAILED"), stage: "verification" as const };
  const existingFinalize = await dataClient().rpc("finalize_test_build", { p_build_id: build.id });
  if (!existingFinalize.error) return { error: null, stage: "complete" as const };
  const upload = await client().storage.from("test-builds").upload(path, input.file, {
    upsert: false,
    contentType: mime,
    cacheControl: "3600",
  });
  if (upload.error) return { error: upload.error, stage: "upload" as const };
  const { error: finalizeError } = await dataClient().rpc("finalize_test_build", { p_build_id: build.id });
  if (finalizeError) return { error: finalizeError, stage: "verification" as const };
  return { error: null, stage: "complete" as const };
}


export interface DeveloperTestAsset {
  id: string;
  test_id: string;
  file_id: string;
  title: string;
  original_filename: string;
  file_extension: string;
  mime_type: string;
  size_bytes: number;
  status: "pending" | "uploaded";
  uploaded_at: string | null;
  created_at: string;
}

export function listDeveloperTestAssets(developerId: string) {
  return dataClient().from("test_assets")
    .select("id,test_id,file_id,title,original_filename,file_extension,mime_type,size_bytes,status,uploaded_at,created_at")
    .eq("developer_id", developerId)
    .order("created_at", { ascending: false });
}

const TEST_ASSET_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Register metadata, upload to private Storage, then verify the stored object through an owner-checked RPC. */
export async function uploadDeveloperTestAsset(input: {
  userId: string;
  testId: string;
  file: File;
  title: string;
  fileId: string;
}) {
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = TEST_ASSET_MIME_BY_EXTENSION[extension];
  if (!mime || (input.file.type && input.file.type !== mime)) {
    return { error: new Error("TEST_ASSET_FILE_TYPE_INVALID"), stage: "validation" as const };
  }
  if (input.file.size < 1 || input.file.size > 52428800) {
    return { error: new Error("TEST_ASSET_FILE_SIZE_INVALID"), stage: "validation" as const };
  }
  const { data: path, error: registerError } = await dataClient().rpc("register_test_asset", {
    p_test_id: input.testId,
    p_file_id: input.fileId,
    p_title: input.title,
    p_original_filename: input.file.name,
    p_mime_type: mime,
    p_size_bytes: input.file.size,
  });
  if (registerError || !path) return { error: registerError ?? new Error("TEST_ASSET_REGISTRATION_FAILED"), stage: "registration" as const };
  const { data: asset, error: lookupError } = await dataClient().from("test_assets")
    .select("id").eq("test_id", input.testId).eq("developer_id", input.userId).eq("storage_path", path).single();
  if (lookupError || !asset) return { error: lookupError ?? new Error("TEST_ASSET_LOOKUP_FAILED"), stage: "verification" as const };
  const existingFinalize = await dataClient().rpc("finalize_test_asset", { p_asset_id: asset.id });
  if (!existingFinalize.error) return { error: null, stage: "complete" as const };
  const upload = await client().storage.from("test-assets").upload(path, input.file, {
    upsert: false,
    contentType: mime,
    cacheControl: "3600",
  });
  if (upload.error) return { error: upload.error, stage: "upload" as const };
  const { error: finalizeError } = await dataClient().rpc("finalize_test_asset", { p_asset_id: asset.id });
  if (finalizeError) return { error: finalizeError, stage: "verification" as const };
  return { error: null, stage: "complete" as const };
}

export type DeveloperFeedbackStatus = "new" | "under_review" | "planned" | "resolved" | "wont_fix";
export type DeveloperFeedbackPriority = "low" | "normal" | "high" | "urgent";
export type DeveloperFeedbackRecord = {
  feedback_id: string;
  test_id: string;
  test_title: string;
  app_name: string;
  category: string;
  body: string;
  rating: number | null;
  submitted_at: string;
  review_status: DeveloperFeedbackStatus;
  priority: DeveloperFeedbackPriority;
  resolution_note: string | null;
  resolved_at: string | null;
  updated_at: string;
};
export type DeveloperFeedbackMessage = {
  sender_label: "You" | "Tester";
  body: string;
  created_at: string;
};

export function listDeveloperFeedback() {
  return dataClient().rpc("get_developer_feedback");
}

export function updateDeveloperFeedbackReview(input: {
  feedbackId: string;
  status: DeveloperFeedbackStatus;
  priority: DeveloperFeedbackPriority;
  resolutionNote: string | null;
}) {
  return dataClient().rpc("update_developer_feedback_review", {
    p_feedback_id: input.feedbackId,
    p_status: input.status,
    p_priority: input.priority,
    p_resolution_note: input.resolutionNote,
  });
}

export function listDeveloperFeedbackMessages(feedbackId: string) {
  return dataClient().rpc("get_developer_feedback_messages", { p_feedback_id: feedbackId });
}

export function sendDeveloperFeedbackMessage(feedbackId: string, body: string) {
  return dataClient().rpc("send_developer_feedback_message", {
    p_feedback_id: feedbackId,
    p_body: body,
  });
}

export function submitAppForReview(appId: string) {
  return dataClient().rpc("submit_app_for_review", { p_app_id: appId });
}

export function reviewDeveloperApp(appId: string, decision: "approved" | "rejected", reason: string) {
  return dataClient().rpc("review_app", { p_app_id: appId, p_decision: decision, p_reason: reason });
}

export function reviewDeveloperTest(testId: string, decision: "approved" | "rejected", reason: string) {
  return dataClient().rpc("review_test", { p_test_id: testId, p_decision: decision, p_reason: reason });
}

export type AdminReviewApp = {
  id: string;
  name: string;
  package_name: string;
  description: string | null;
  category: string;
  developer_id: string;
  created_at: string;
};

export type AdminReviewTest = {
  id: string;
  app_id: string;
  title: string;
  description: string | null;
  test_type: string;
  min_testers: number;
  developer_id: string;
  created_at: string;
};

/** Load the administrator review queue; database permissions remain enforced by RLS. */
export async function getAdminReviewQueue() {
  const [apps, tests] = await Promise.all([
    dataClient()
      .from("apps")
      .select("id,name,package_name,description,category,developer_id,created_at")
      .eq("status", "submitted")
      .order("created_at", { ascending: true }),
    dataClient()
      .from("tests")
      .select("id,app_id,title,description,test_type,min_testers,developer_id,created_at")
      .eq("status", "submitted")
      .order("created_at", { ascending: true }),
  ]);
  return { apps, tests };
}



export type SixStepTestConfig = {
  cohort: { targetTesters: number; notes: string | null };
  rules: { androidVersion: string; instructions: string | null };
  details: { testingObjective: string; priority: "low" | "medium" | "high"; testingScope: string[]; successCriteria: string | null; minimumCompletionRate: number };
  schedule: { durationDays: number | null; allowMoreTesters: boolean; joiningMethod: "google_play_link" | "closed_group" | "upload_list" | "open_testing"; collectFeedback: boolean; enableBugReports: boolean };
  googlePlay: { track: "internal" | "closed" | "open"; testerMethod: "join_link" | "google_groups" | "upload_list"; appVersion: "latest_available" | "to_be_uploaded"; releaseMode: "immediately" | "scheduled"; releaseAt: string | null };
};

/** Create the draft and its allowlisted six-step configuration atomically through the V2 RPC. */
export function createDeveloperTestWithConfig(input: DeveloperTestInput & { testConfig: SixStepTestConfig }) {
  return dataClient().rpc("create_test_with_config", {
    p_app_id: input.appId,
    p_title: input.title,
    p_description: input.description,
    p_short_summary: input.shortSummary ?? null,
    p_test_type: input.testType,
    p_min_testers: input.minTesters,
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_duration: input.durationMinutes ?? null,
    p_instructions: input.instructions ?? null,
    p_test_config: input.testConfig,
  });
}
