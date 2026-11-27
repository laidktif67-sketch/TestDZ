import { getAppDataClient, getSupabaseServiceClient } from "../../lib/supabase-data";

export type DeveloperAssignmentSubmission = {
  id: string;
  assignment_id: string;
  test_id: string;
  tester_id: string;
  summary: string;
  comments: string | null;
  status: "submitted";
  submitted_at: string;
  review_due_at: string | null;
  attempt_number: number;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
};

export type DeveloperSubmissionHistoryItem = {
  id: string;
  attempt_number: number;
  status: "draft" | "submitted" | "changes_requested" | "approved" | "auto_approved";
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type DeveloperSubmissionTest = {
  id: string;
  title: string;
};

export type DeveloperSubmissionAttachment = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
};

export function listDeveloperAssignmentSubmissions() {
  return getAppDataClient().from("assignment_submissions")
    .select("id,assignment_id,test_id,tester_id,summary,comments,status,submitted_at,review_due_at,attempt_number,reviewed_by,reviewed_at,review_note")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });
}

export function listDeveloperSubmissionTests(testIds: string[]) {
  if (testIds.length === 0) return Promise.resolve({ data: [], error: null });
  return getAppDataClient().from("tests").select("id,title").in("id", testIds);
}

export function listDeveloperSubmissionHistory(assignmentId: string) {
  return getAppDataClient().from("assignment_submissions")
    .select("id,attempt_number,status,submitted_at,reviewed_at,review_note")
    .eq("assignment_id", assignmentId)
    .order("attempt_number", { ascending: false });
}

export function listDeveloperSubmissionAttachments(submissionId: string) {
  return getAppDataClient().from("assignment_submission_attachments")
    .select("id,original_filename,mime_type,size_bytes,storage_path")
    .eq("submission_id", submissionId);
}

export function reviewDeveloperAssignmentSubmission(
  submissionId: string,
  decision: "approved" | "changes_requested",
  reason: string | null,
) {
  return getAppDataClient().rpc("review_assignment_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_reason: reason,
  });
}

export function getDeveloperSubmissionEvidenceUrl(storagePath: string) {
  return getSupabaseServiceClient().storage.from("test-evidence").createSignedUrl(storagePath, 300);
}
