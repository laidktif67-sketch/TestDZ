import { getAppDataClient, getSupabaseServiceClient } from "../../lib/supabase-data";

export type AdminMedicalExceptionRequest = {
  id: string;
  assignment_id: string;
  tester_id: string;
  reason: string;
  requested_dates: string[];
  evidence_storage_path: string | null;
  created_at: string;
};

export type AdminFeedbackQualityItem = {
  id: string;
  assignment_id: string;
  tester_id: string;
  category: string;
  body: string;
  rating: number | null;
  created_at: string;
};

export function listPendingMedicalExceptionRequests() {
  return getAppDataClient().from("medical_exception_requests")
    .select("id,assignment_id,tester_id,reason,requested_dates,evidence_storage_path,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
}

export function listPendingFeedbackQuality() {
  return getAppDataClient().from("feedback")
    .select("id,assignment_id,tester_id,category,body,rating,created_at")
    .eq("quality_status", "pending")
    .order("created_at", { ascending: true });
}

export function reviewMedicalExceptionRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reviewNote: string,
) {
  return getAppDataClient().rpc("review_medical_exception", {
    p_request_id: requestId,
    p_decision: decision,
    p_review_note: reviewNote,
  });
}

export function reviewFeedbackQuality(
  feedbackId: string,
  decision: "accepted" | "rejected",
  reviewNote: string,
) {
  return getAppDataClient().rpc("review_feedback_quality", {
    p_feedback_id: feedbackId,
    p_decision: decision,
    p_review_note: reviewNote,
  });
}

export async function getMedicalExceptionEvidenceUrl(storagePath: string) {
  return getSupabaseServiceClient().storage
    .from("medical-exception-evidence")
    .createSignedUrl(storagePath, 300);
}
