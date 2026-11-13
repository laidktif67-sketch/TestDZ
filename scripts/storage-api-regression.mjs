import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(baseUrl && anonKey && serviceKey, "SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required");

const suffix = randomUUID().slice(0, 8);
const createdUsers = [];
const uploaded = [];
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write(`PASS ${message}\n`);
}
function uuid() { return randomUUID(); }
async function request(path, { method = "GET", token = serviceKey, body, contentType, extraHeaders = {} } = {}) {
  const headers = { apikey: token === serviceKey ? serviceKey : anonKey, Authorization: `Bearer ${token}`, ...extraHeaders };
  if (contentType) headers["Content-Type"] = contentType;
  else if (body !== undefined && !(body instanceof Buffer)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers,
    body: body === undefined ? undefined : (typeof body === "string" || body instanceof Buffer ? body : JSON.stringify(body))
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data, text };
}
async function must(path, options, label) {
  const result = await request(path, options);
  if (!result.response.ok) throw new Error(`${label}: HTTP ${result.response.status}: ${result.text}`);
  return result.data;
}
async function expectDenied(path, options, message) {
  const result = await request(path, options);
  check(!result.response.ok, message);
}
async function createActor(label, roles) {
  const email = `storage-${label}-${suffix}@example.test`;
  const password = `Tdz-${uuid()}-Aa9!`;
  const created = await must("/auth/v1/admin/users", {
    method: "POST", body: { email, password, email_confirm: true }
  }, `create ${label} auth user`);
  createdUsers.push(created.id);
  await must("/rest/v1/profiles", {
    method: "POST", body: { id: created.id, display_name: `Storage API ${label}` },
    extraHeaders: { Prefer: "resolution=merge-duplicates,return=minimal" }
  }, `create ${label} profile`);
  await must("/rest/v1/user_roles", {
    method: "POST", body: roles.map(role => ({ user_id: created.id, role })),
    extraHeaders: { Prefer: "resolution=ignore-duplicates,return=minimal" }
  }, `assign ${label} roles`);
  const session = await must("/auth/v1/token?grant_type=password", {
    method: "POST", token: anonKey, body: { email, password }
  }, `sign in ${label}`);
  return { id: created.id, token: session.access_token };
}
async function insert(table, row, label) {
  await must(`/rest/v1/${table}`, { method: "POST", body: row }, label);
}
async function insertAs(actor, table, row, label) {
  await must(`/rest/v1/${table}`, { method: "POST", token: actor.token, body: row }, label);
}
async function removeRows(table, filter, label) {
  const result = await request(`/rest/v1/${table}?${filter}`, { method: "DELETE" });
  if (!result.response.ok) process.stderr.write(`Cleanup warning (${label}): ${result.response.status} ${result.text}\n`);
}
function objectPath(bucket, path) { return `/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`; }
async function upload(actor, bucket, path, body, mime = "text/plain") {
  const result = await request(objectPath(bucket, path), {
    method: "POST", token: actor.token, body, contentType: mime,
    extraHeaders: { "x-upsert": "false" }
  });
  if (result.response.ok) uploaded.push({ bucket, path });
  return result;
}
async function download(actor, bucket, path) {
  return request(`/storage/v1/object/authenticated/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    token: actor.token
  });
}
async function removeObjects(bucket, paths) {
  const result = await request(`/storage/v1/object/${bucket}`, { method: "DELETE", body: { prefixes: paths } });
  if (!result.response.ok) process.stderr.write(`Storage cleanup warning (${bucket}): ${result.response.status} ${result.text}\n`);
}

const appTesterId = uuid(), appDeveloperId = uuid();
const testTesterId = uuid(), testDeveloperId = uuid();
const cohortId = uuid(), assignmentId = uuid(), feedbackId = uuid();
const ticketId = uuid(), closedTicketId = uuid(), reportId = uuid();

try {
  const tester = await createActor("tester", ["tester", "developer"]);
  const developer = await createActor("developer", ["developer"]);
  const outsider = await createActor("outsider", ["tester"]);
  const support = await createActor("support", ["support"]);

  await insert("apps", [
    { id: appTesterId, developer_id: tester.id, name: "Storage Tester App", package_name: `test.storage.tester.${suffix}` },
    { id: appDeveloperId, developer_id: developer.id, name: "Storage Developer App", package_name: `test.storage.developer.${suffix}` }
  ], "seed apps");
  await insert("tests", [
    { id: testTesterId, app_id: appTesterId, developer_id: tester.id, title: "Storage tester fixture" },
    { id: testDeveloperId, app_id: appDeveloperId, developer_id: developer.id, title: "Storage developer fixture" }
  ], "seed tests");
  await insert("cohorts", { id: cohortId, name: `Storage API ${suffix}`, capacity: 4 }, "seed cohort");
  await insert("cohort_tests", [
    { cohort_id: cohortId, test_id: testTesterId, developer_id: tester.id },
    { cohort_id: cohortId, test_id: testDeveloperId, developer_id: developer.id }
  ], "seed cohort test membership");
  await insert("assignments", {
    id: assignmentId, cohort_id: cohortId, test_id: testDeveloperId, tester_id: tester.id, status: "active"
  }, "seed active assignment");
  await insert("feedback", {
    id: feedbackId, assignment_id: assignmentId, tester_id: tester.id,
    body: "Storage API integration fixture feedback with sufficient length."
  }, "seed feedback");
  await insert("support_tickets", [
    { id: ticketId, user_id: tester.id, requester_role: "tester", subject: "Storage API test ticket", category: "technical", description: "Fixture ticket for Storage API integration coverage.", status: "open" },
    { id: closedTicketId, user_id: tester.id, requester_role: "tester", subject: "Closed Storage API ticket", category: "technical", description: "Closed fixture ticket must reject new uploads.", status: "closed" }
  ], "seed support tickets");
  await insert("reports", {
    id: reportId, reporter_id: tester.id, assignment_id: assignmentId,
    report_type: "other", description: "Storage API evidence integration fixture."
  }, "seed report");

  // Support attachments: owner upload/download, cross-user read/write denial,
  // closed-ticket denial, and bucket MIME/size enforcement.
  const supportPath = `${ticketId}/${tester.id}/support-${suffix}.txt`;
  let result = await upload(tester, "support-attachments", supportPath, Buffer.from("support evidence"), "text/plain");
  check(result.response.ok, "ticket owner uploads support attachment through Storage API");
  result = await download(tester, "support-attachments", supportPath);
  check(result.response.ok && result.text.includes("support evidence"), "ticket owner downloads support attachment through Storage API");
  result = await download(support, "support-attachments", supportPath);
  check(result.response.ok && result.text.includes("support evidence"), "authorized support staff downloads support attachment");
  await expectDenied(`/storage/v1/object/authenticated/support-attachments/${supportPath}`, { token: outsider.token }, "unrelated user cannot download support attachment");
  await expectDenied(objectPath("support-attachments", `${ticketId}/${outsider.id}/forged.txt`), {
    method: "POST", token: outsider.token, body: Buffer.from("forged"), contentType: "text/plain"
  }, "unrelated user cannot upload to another user's ticket");
  await expectDenied(objectPath("support-attachments", `${closedTicketId}/${tester.id}/closed.txt`), {
    method: "POST", token: tester.token, body: Buffer.from("closed"), contentType: "text/plain"
  }, "closed ticket rejects new attachment upload");
  await expectDenied(objectPath("support-attachments", `${ticketId}/${tester.id}/wrong-mime.html`), {
    method: "POST", token: tester.token, body: Buffer.from("<html/>"), contentType: "text/html"
  }, "support bucket rejects disallowed MIME type");
  await expectDenied(objectPath("support-attachments", `${ticketId}/${tester.id}/too-large.txt`), {
    method: "POST", token: tester.token, body: Buffer.alloc(10 * 1024 * 1024 + 1), contentType: "text/plain"
  }, "support bucket rejects files larger than 10 MiB");

  const supportMessageId = uuid();
  await insertAs(tester, "support_ticket_messages", {
    id: supportMessageId, ticket_id: ticketId, sender_id: tester.id, body: "Storage API support attachment message."
  }, "insert support message");
  await insertAs(tester, "support_ticket_attachments", {
    ticket_id: ticketId, message_id: supportMessageId, uploaded_by: tester.id,
    storage_path: supportPath, original_filename: "support.txt", mime_type: "text/plain", size_bytes: 16
  }, "insert support attachment metadata");

  // Developer feedback attachments: tester uploads; tester and owning developer
  // can read; an unrelated account cannot.
  const feedbackPath = `${feedbackId}/${tester.id}/feedback-${suffix}.txt`;
  result = await upload(tester, "developer-feedback-attachments", feedbackPath, Buffer.from("feedback evidence"), "text/plain");
  check(result.response.ok, "feedback participant uploads attachment through Storage API");
  result = await download(developer, "developer-feedback-attachments", feedbackPath);
  check(result.response.ok && result.text.includes("feedback evidence"), "owning developer downloads feedback attachment");
  await expectDenied(`/storage/v1/object/authenticated/developer-feedback-attachments/${feedbackPath}`, { token: outsider.token }, "unrelated user cannot download feedback attachment");
  await expectDenied(objectPath("developer-feedback-attachments", `${feedbackId}/${outsider.id}/forged.txt`), {
    method: "POST", token: outsider.token, body: Buffer.from("forged"), contentType: "text/plain"
  }, "unrelated user cannot upload feedback attachment");

  const feedbackMessageId = uuid();
  await insertAs(tester, "developer_feedback_messages", {
    id: feedbackMessageId, feedback_id: feedbackId, sender_id: tester.id, body: "Storage API feedback attachment message."
  }, "insert feedback message");
  await insertAs(tester, "developer_feedback_attachments", {
    feedback_id: feedbackId, message_id: feedbackMessageId, uploaded_by: tester.id,
    storage_path: feedbackPath, original_filename: "feedback.txt", mime_type: "text/plain", size_bytes: 17
  }, "insert feedback attachment metadata");

  // Final assignment submission evidence: upload while the assignment is active,
  // then expose the private object only after the submission RPC records metadata.
  const assignmentFileId = uuid();
  const assignmentEvidencePath = `${testDeveloperId}/${tester.id}/${assignmentId}/${assignmentFileId}.pdf`;
  result = await upload(tester, "assignment-evidence", assignmentEvidencePath, Buffer.from("%PDF-1.4\\nTestDZ evidence\\n%%EOF"), "application/pdf");
  check(result.response.ok, "active tester uploads private final-assignment evidence");
  const submitted = await must("/rest/v1/rpc/submit_assignment_report", {
    method: "POST", token: tester.token,
    body: {
      p_assignment_id: assignmentId,
      p_report_text: "The application was tested across the agreed scenarios and the results were recorded with supporting evidence.",
      p_comments: "Storage integration test submission.",
      p_files: [{ path: assignmentEvidencePath, name: "final-evidence.pdf", mime_type: "application/pdf", size_bytes: 28 }]
    }
  }, "submit final assignment report");
  check(submitted?.status === "submitted" && submitted?.attachments_count === 1, "tester submits report and attachment metadata through the RPC");
  result = await download(tester, "assignment-evidence", assignmentEvidencePath);
  check(result.response.ok && result.text.includes("TestDZ evidence"), "submitting tester can download their final evidence");
  result = await download(developer, "assignment-evidence", assignmentEvidencePath);
  check(result.response.ok && result.text.includes("TestDZ evidence"), "owning developer can download submitted final evidence");
  await expectDenied(`/storage/v1/object/authenticated/assignment-evidence/${assignmentEvidencePath}`, { token: outsider.token }, "unrelated account cannot download final assignment evidence");
  await expectDenied(objectPath("assignment-evidence", `${testDeveloperId}/${outsider.id}/${assignmentId}/${uuid()}.pdf`), {
    method: "POST", token: outsider.token, body: Buffer.from("%PDF-1.4\\nforged\\n%%EOF"), contentType: "application/pdf"
  }, "unrelated account cannot upload final assignment evidence");
  await expectDenied(objectPath("assignment-evidence", `${testDeveloperId}/${tester.id}/${assignmentId}/${uuid()}.pdf`), {
    method: "POST", token: tester.token, body: Buffer.from("%PDF-1.4\\nlate\\n%%EOF"), contentType: "application/pdf"
  }, "assignment cannot accept additional evidence after final submission");
  await expectDenied("/rest/v1/rpc/submit_assignment_report", {
    method: "POST", token: tester.token,
    body: { p_assignment_id: assignmentId, p_report_text: "A second report must not be accepted for the same assignment.", p_comments: "", p_files: [] }
  }, "duplicate final report submission is rejected");

  // Evidence object keys are bound to test/tester/report/file identity.
  const fileId = uuid();
  const evidencePath = `${testDeveloperId}/${tester.id}/${reportId}/${fileId}.txt`;
  result = await upload(tester, "test-evidence", evidencePath, Buffer.from("report evidence"), "text/plain");
  check(result.response.ok, "reporting tester uploads evidence through Storage API");
  result = await download(developer, "test-evidence", evidencePath);
  check(result.response.ok && result.text.includes("report evidence"), "owning developer downloads report evidence");
  result = await download(tester, "test-evidence", evidencePath);
  check(result.response.ok && result.text.includes("report evidence"), "reporting tester downloads report evidence");
  await expectDenied(`/storage/v1/object/authenticated/test-evidence/${evidencePath}`, { token: outsider.token }, "unrelated user cannot download report evidence");
  await expectDenied(objectPath("test-evidence", `${testDeveloperId}/${outsider.id}/${reportId}/${uuid()}.txt`), {
    method: "POST", token: outsider.token, body: Buffer.from("forged"), contentType: "text/plain"
  }, "unrelated user cannot upload report evidence");
  await expectDenied(objectPath("test-evidence", `${testDeveloperId}/${tester.id}/${reportId}/${uuid()}.html`), {
    method: "POST", token: tester.token, body: Buffer.from("<html/>"), contentType: "text/html"
  }, "test evidence bucket rejects disallowed extension or MIME");

  await insertAs(tester, "report_attachments", {
    report_id: reportId, assignment_id: assignmentId, test_id: testDeveloperId,
    tester_id: tester.id, file_id: fileId, file_extension: "txt", original_filename: "evidence.txt"
  }, "insert report attachment metadata");

  const signed = await must(`/storage/v1/object/sign/support-attachments/${supportPath}`, {
    method: "POST", token: tester.token, body: { expiresIn: 60 }
  }, "create authorized signed URL");
  check(typeof signed.signedURL === "string" && signed.signedURL.length > 0, "authorized participant can create a short-lived signed URL");
  await expectDenied(`/storage/v1/object/sign/support-attachments/${supportPath}`, {
    method: "POST", token: outsider.token, body: { expiresIn: 60 }
  }, "unrelated user cannot mint a signed URL");

  process.stdout.write(`Storage API regression passed: ${checks} assertions.\n`);
} finally {
  for (const bucket of ["support-attachments", "developer-feedback-attachments", "test-evidence", "assignment-evidence"]) {
    const paths = uploaded.filter(item => item.bucket === bucket).map(item => item.path);
    if (paths.length) await removeObjects(bucket, paths);
  }
  await removeRows("report_attachments", `report_id=eq.${reportId}`, "report attachment metadata");
  await removeRows("assignment_submission_attachments", `assignment_id=eq.${assignmentId}`, "assignment submission attachment metadata");
  await removeRows("assignment_submissions", `assignment_id=eq.${assignmentId}`, "assignment submission");
  await removeRows("reports", `id=eq.${reportId}`, "report");
  await removeRows("support_ticket_attachments", `ticket_id=eq.${ticketId}`, "support attachment metadata");
  await removeRows("support_ticket_messages", `ticket_id=eq.${ticketId}`, "support messages");
  await removeRows("support_tickets", `id=in.(${ticketId},${closedTicketId})`, "support tickets");
  await removeRows("developer_feedback_attachments", `feedback_id=eq.${feedbackId}`, "feedback attachment metadata");
  await removeRows("developer_feedback_messages", `feedback_id=eq.${feedbackId}`, "feedback messages");
  await removeRows("feedback", `id=eq.${feedbackId}`, "feedback");
  await removeRows("assignments", `id=eq.${assignmentId}`, "assignment");
  await removeRows("cohort_tests", `cohort_id=eq.${cohortId}`, "cohort test membership");
  await removeRows("cohorts", `id=eq.${cohortId}`, "cohort");
  await removeRows("tests", `id=in.(${testTesterId},${testDeveloperId})`, "tests");
  await removeRows("apps", `id=in.(${appTesterId},${appDeveloperId})`, "apps");
  for (const userId of createdUsers.reverse()) {
    // Auth bootstrap creates a wallet row referencing the profile; remove this
    // test-only dependent row before deleting the Auth user/profile.
    await removeRows("wallets", `user_id=eq.${userId}`, `test wallet for ${userId}`);
    const result = await request(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    if (!result.response.ok) process.stderr.write(`Auth cleanup warning (${userId}): ${result.response.status} ${result.text}\n`);
  }
}
