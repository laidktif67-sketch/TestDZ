import { getAppDataClient, getSupabaseServiceClient } from "../../lib/supabase-data";

export type MedicalExceptionRequest = {
  id: string;
  assignment_id: string;
  reason: string;
  requested_dates: string[];
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  evidence_storage_path: string | null;
};

export function listTesterMedicalExceptionRequests(assignmentId: string) {
  return getAppDataClient().from("medical_exception_requests")
    .select("id,assignment_id,reason,requested_dates,status,review_note,created_at,evidence_storage_path")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });
}

export function createTesterMedicalExceptionRequest(input: {
  assignmentId: string;
  reason: string;
  requestedDates: string[];
}) {
  return getAppDataClient().rpc("create_medical_exception_request", {
    p_assignment_id: input.assignmentId,
    p_reason: input.reason,
    p_requested_dates: input.requestedDates,
  });
}

export function uploadMedicalExceptionEvidence(path: string, file: File) {
  return getSupabaseServiceClient().storage.from("medical-exception-evidence").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
}

export function attachTesterMedicalExceptionEvidence(requestId: string, storagePath: string) {
  return getAppDataClient().rpc("attach_medical_exception_evidence", {
    p_request_id: requestId,
    p_storage_path: storagePath,
  });
}
