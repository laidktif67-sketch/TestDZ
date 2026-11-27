import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";

/** Read-only assignment submission context. Uploads and finalization remain in the workflow page. */
export async function getAssignmentSubmissionPageData(assignmentId: string, userId: string) {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    const [assignmentResult, checkinsResult, feedbackResult] = await Promise.all([
      client.from("assignments")
        .select("id,status,test_id,assigned_at,started_at,completed_at")
        .eq("id", assignmentId).eq("tester_id", userId).maybeSingle(),
      client.from("checkins").select("id,checkin_date")
        .eq("assignment_id", assignmentId).eq("tester_id", userId)
        .order("checkin_date", { ascending: true }),
      client.from("feedback").select("id", { count: "exact", head: true })
        .eq("assignment_id", assignmentId).eq("tester_id", userId),
    ]);
    if (assignmentResult.error || !assignmentResult.data) {
      return { error: assignmentResult.error?.message || "This assignment could not be found.", assignment: null, checkins: [], feedbackCount: 0 };
    }
    const testResult = await client.from("tests")
      .select("id,title,status,start_date,end_date,app_id")
      .eq("id", assignmentResult.data.test_id).maybeSingle();
    if (testResult.error || !testResult.data) {
      return { error: testResult.error?.message || "The assigned test could not be found.", assignment: null, checkins: [], feedbackCount: 0 };
    }
    const appResult = await client.from("apps").select("name,icon_url")
      .eq("id", testResult.data.app_id).maybeSingle();
    return {
      error: appResult.error ? "Some app information could not be loaded." : "",
      assignment: {
        id: assignmentResult.data.id,
        status: assignmentResult.data.status,
        start_date: assignmentResult.data.started_at || assignmentResult.data.assigned_at,
        completed_at: assignmentResult.data.completed_at,
        created_at: assignmentResult.data.assigned_at,
        points_awarded: null,
        test: {
          id: testResult.data.id, title: testResult.data.title, status: testResult.data.status,
          start_date: testResult.data.start_date, end_date: testResult.data.end_date,
          app: appResult.data || null,
        },
      },
      checkins: checkinsResult.data || [],
      feedbackCount: feedbackResult.count || 0,
    };
  }

  const [assignmentResult, checkinsResult, feedbackResult] = await Promise.all([
    client.from("assignments")
      .select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,start_date,end_date,app:apps(name,icon_url))")
      .eq("id", assignmentId).eq("tester_id", userId).maybeSingle(),
    client.from("checkins").select("id,checkin_date")
      .eq("assignment_id", assignmentId).eq("tester_id", userId)
      .order("checkin_date", { ascending: true }),
    client.from("feedback").select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId).eq("tester_id", userId),
  ]);
  return {
    error: assignmentResult.error?.message || (!assignmentResult.data ? "This assignment could not be found." : ""),
    assignment: assignmentResult.data || null,
    checkins: checkinsResult.data || [],
    feedbackCount: feedbackResult.count || 0,
  };
}

/** Read-only active-assignment page data. Cross-user leaderboard enumeration is intentionally excluded. */
export async function getActiveAssignmentProgressPageData(assignmentId: string, userId: string) {
  const client = getAppDataClient();
  const [profile, notice, checkins, feedback] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    client.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("recipient_role", "tester").is("read_at", null),
    client.from("checkins").select(isTesterWorkflowV2Enabled ? "id,checkin_date" : "id,checkin_date,evidence_url")
      .eq("assignment_id", assignmentId).eq("tester_id", userId).order("checkin_date"),
    client.from("feedback").select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId).eq("tester_id", userId),
  ]);

  if (isTesterWorkflowV2Enabled) {
    const assignmentResult = await client.from("assignments")
      .select("id,status,assigned_at,started_at,medical_extension_days,test_id")
      .eq("id", assignmentId).eq("tester_id", userId).maybeSingle();
    if (assignmentResult.error || !assignmentResult.data) {
      return {
        error: assignmentResult.error?.message || "This assignment could not be found.",
        assignment: null, profile, notice, checkins, feedback, earned: 0,
      };
    }

    const medicalResult = await client.from("medical_exception_requests")
      .select("requested_dates")
      .eq("assignment_id", assignmentId)
      .eq("status", "approved");
    if (medicalResult.error) {
      return {
        error: "Approved medical exception dates could not be loaded.",
        assignment: null, profile, notice, checkins, feedback, earned: 0,
      };
    }
    const approvedMedicalDates = (medicalResult.data ?? [])
      .flatMap((row: { requested_dates: string[] }) => row.requested_dates ?? [])
      .sort();

    const testResult = await client.from("tests")
      .select("id,title,description,short_summary,start_date,end_date,app_id")
      .eq("id", assignmentResult.data.test_id).maybeSingle();
    if (testResult.error || !testResult.data) {
      return {
        error: testResult.error?.message || "The assigned test could not be found.",
        assignment: null, profile, notice, checkins, feedback, earned: 0,
      };
    }
    const appResult = await client.from("apps")
      .select("name,icon_url,category,play_store_url")
      .eq("id", testResult.data.app_id).maybeSingle();

    return {
      error: appResult.error ? "Some app information could not be loaded." : "",
      profile, notice, checkins, feedback, earned: 0,
      assignment: {
        id: assignmentResult.data.id,
        status: assignmentResult.data.status,
        start_date: assignmentResult.data.started_at || assignmentResult.data.assigned_at,
        medical_extension_days: assignmentResult.data.medical_extension_days || 0,
        approved_medical_dates: approvedMedicalDates,
        test: {
          id: testResult.data.id, title: testResult.data.title,
          description: testResult.data.description, short_summary: testResult.data.short_summary,
          start_date: testResult.data.start_date, end_date: testResult.data.end_date,
          app: appResult.data || null,
        },
      },
    };
  }

  const [assignmentResult, ledgerResult] = await Promise.all([
    client.from("assignments")
      .select("id,status,start_date,medical_extension_days,test:tests(id,title,description,short_summary,start_date,end_date,app:apps(name,icon_url,category,play_store_url))")
      .eq("id", assignmentId).eq("tester_id", userId).maybeSingle(),
    client.from("points_ledger").select("amount").eq("user_id", userId)
      .eq("wallet_type", "earned_points").eq("reference_id", assignmentId),
  ]);
  if (assignmentResult.error || !assignmentResult.data) {
    return {
      error: assignmentResult.error?.message || "This assignment could not be found.",
      assignment: null, profile, notice, checkins, feedback, earned: 0,
    };
  }
  return {
    error: "",
    profile, notice, checkins, feedback,
    earned: (ledgerResult.data ?? []).reduce((sum: number, row: { amount: number | string }) => sum + Number(row.amount || 0), 0),
    assignment: { ...assignmentResult.data, approved_medical_dates: [] },
  };
}

/** Start an assigned V2 test through its guarded workflow RPC. */
export async function startTesterAssignment(assignmentId: string) {
  return getAppDataClient().rpc("start_assignment", { p_assignment_id: assignmentId });
}

/** Record today's V2 check-in and return the server-created check-in row. */
export async function submitTesterDailyCheckin(assignmentId: string) {
  const client = getAppDataClient();
  const result = await client.rpc("submit_checkin", { p_assignment_id: assignmentId, p_note: null });
  if (result.error || !result.data) {
    if (result.error) return { error: result.error, checkin: null, recorded: false };
    const assignment = await client.from("assignments").select("status").eq("id", assignmentId).maybeSingle();
    const error = assignment.data?.status === "failed" ? new Error("ASSIGNMENT_INTERRUPTED") : new Error("CHECKIN_NOT_RECORDED");
    return { error, checkin: null, recorded: false };
  }
  const checkin = await client.from("checkins").select("id,checkin_date")
    .eq("id", result.data).maybeSingle();
  return { error: checkin.error, checkin: checkin.data || null, recorded: true };
}

/** Read the current submission state for the signed-in tester's assignment. */
export async function getTesterAssignmentSubmission(assignmentId: string) {
  return getAppDataClient().from("assignment_submissions")
    .select("id,status").eq("assignment_id", assignmentId).maybeSingle();
}

/** Create or retrieve the server-managed submission draft. */
export async function createTesterAssignmentSubmission(
  assignmentId: string, summary: string, comments: string | null
) {
  return getAppDataClient().rpc("create_assignment_submission", {
    p_assignment_id: assignmentId, p_summary: summary, p_comments: comments,
  });
}

/** List the registered attachment metadata for a submission. */
export async function getTesterSubmissionAttachments(submissionId: string) {
  return getAppDataClient().from("assignment_submission_attachments")
    .select("file_id,original_filename,mime_type,size_bytes,storage_path")
    .eq("submission_id", submissionId);
}

/** Register an evidence file before uploading its bytes to private Storage. */
export async function registerTesterSubmissionAttachment(input: {
  submissionId: string;
  fileId: string;
  extension: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return getAppDataClient().rpc("register_assignment_submission_attachment", {
    p_submission_id: input.submissionId,
    p_file_id: input.fileId,
    p_extension: input.extension,
    p_original_filename: input.originalFilename,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
  });
}

/** Finalize only after all evidence uploads have completed successfully. */
export async function finalizeTesterAssignmentSubmission(submissionId: string) {
  return getAppDataClient().rpc("finalize_assignment_submission", {
    p_submission_id: submissionId,
  });
}

/** Load an assignment and its test metadata for the assignment-details screen. */
export async function getTesterAssignmentDetailsPageData(assignmentId: string, userId: string) {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    const assignment = await client.from("assignments")
      .select("id,status,test_id,assigned_at,started_at,completed_at")
      .eq("id", assignmentId).eq("tester_id", userId).maybeSingle();
    if (assignment.error || !assignment.data) {
      return { data: null, assets: [], error: assignment.error };
    }
    const test = await client.from("tests")
      .select("id,title,description,short_summary,start_date,end_date,app_id")
      .eq("id", assignment.data.test_id).maybeSingle();
    if (test.error || !test.data) return { data: null, assets: [], error: test.error };
    const [app, assets] = await Promise.all([
      client.from("apps").select("name,icon_url,category").eq("id", test.data.app_id).maybeSingle(),
      client.from("test_assets")
        .select("id,title,original_filename,mime_type,size_bytes,storage_path")
        .eq("test_id", test.data.id).eq("status", "uploaded")
        .order("created_at", { ascending: false }),
    ]);
    return {
      data: {
        id: assignment.data.id,
        status: assignment.data.status,
        start_date: assignment.data.started_at || assignment.data.assigned_at,
        points_awarded: null,
        test: {
          id: test.data.id, title: test.data.title, description: test.data.description,
          short_summary: test.data.short_summary, start_date: test.data.start_date,
          end_date: test.data.end_date, app: app.data || null,
        },
      },
      assets: assets.data ?? [],
      error: app.error || assets.error || null,
    };
  }
  const assignment = await client.from("assignments")
    .select("id,status,start_date,points_awarded,test:tests(id,title,description,short_summary,start_date,end_date,app:apps(name,icon_url,category))")
    .eq("id", assignmentId).eq("tester_id", userId).maybeSingle();
  return { data: assignment.data, assets: [], error: assignment.error };
}

/** Legacy-only completion summary reads; the V2 screen intentionally redirects to the wallet. */
export async function getLegacyTesterCompletionSummaryPageData(assignmentId: string, userId: string) {
  const client = getAppDataClient();
  const [assignment, checkins, feedback, ledger, profile] = await Promise.all([
    client.from("assignments")
      .select("id,status,start_date,completed_at,points_awarded,test:tests(title,start_date,end_date,app:apps(name,icon_url))")
      .eq("id", assignmentId).eq("tester_id", userId).maybeSingle(),
    client.from("checkins").select("id,checkin_date")
      .eq("assignment_id", assignmentId).eq("tester_id", userId).order("checkin_date"),
    client.from("feedback").select("id,body,quality_status,created_at,reviewed_at")
      .eq("assignment_id", assignmentId).eq("tester_id", userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("points_ledger").select("id,amount,reason,reference_id,reference_type,created_at")
      .eq("user_id", userId).eq("wallet_type", "earned_points")
      .eq("reference_id", assignmentId).order("created_at"),
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
  ]);
  return { assignment, checkins, feedback, ledger, profile };
}
