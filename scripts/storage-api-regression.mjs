import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && anonKey && serviceKey, "SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const makeClient = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const id = () => randomUUID();
const suffix = randomUUID().slice(0, 8);
const createdUsers = [];
const uploaded = [];
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write(`PASS ${message}\n`);
}
function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function expectDenied(promise, message) {
  const result = await promise;
  check(Boolean(result.error), message);
}
async function createActor(label, roles) {
  const email = `storage-${label}-${suffix}@example.test`;
  const password = `Tdz-${randomUUID()}-Aa9!`;
  const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `create ${label} auth user`);
  createdUsers.push(created.id);
  must(await admin.from("profiles").upsert({ id: created.id, display_name: `Storage API ${label}` }), `create ${label} profile`);
  must(await admin.from("user_roles").insert(roles.map(role => ({ user_id: created.id, role }))), `assign ${label} roles`);
  const client = makeClient();
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
  return { id: created.id, client };
}
async function upload(client, bucket, path, body, contentType = "text/plain") {
  const result = await client.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (!result.error) uploaded.push({ bucket, path });
  return result;
}
async function download(client, bucket, path) {
  return client.storage.from(bucket).download(path);
}

const testerId = id();
const developerId = id();
const outsiderId = id();
const appTesterId = id();
const appDeveloperId = id();
const testTesterId = id();
const testDeveloperId = id();
const cohortId = id();
const assignmentId = id();
const feedbackId = id();
const ticketId = id();
const closedTicketId = id();
const reportId = id();

try {
  const tester = await createActor("tester", ["tester", "developer"]);
  const developer = await createActor("developer", ["developer"]);
  const outsider = await createActor("outsider", ["tester"]);
  assert.equal(tester.id, testerId, "fixture actor IDs are generated before insertion");

  must(await admin.from("apps").insert([
    { id: appTesterId, developer_id: tester.id, name: "Storage Tester App", package_name: `test.storage.tester.${suffix}` },
    { id: appDeveloperId, developer_id: developer.id, name: "Storage Developer App", package_name: `test.storage.developer.${suffix}` }
  ]), "seed apps");
  must(await admin.from("tests").insert([
    { id: testTesterId, app_id: appTesterId, developer_id: tester.id, title: "Storage tester fixture" },
    { id: testDeveloperId, app_id: appDeveloperId, developer_id: developer.id, title: "Storage developer fixture" }
  ]), "seed tests");
  must(await admin.from("cohorts").insert({ id: cohortId, name: `Storage API ${suffix}`, capacity: 4 }), "seed cohort");
  must(await admin.from("cohort_tests").insert([
    { cohort_id: cohortId, test_id: testTesterId, developer_id: tester.id },
    { cohort_id: cohortId, test_id: testDeveloperId, developer_id: developer.id }
  ]), "seed cohort test membership");
  must(await admin.from("assignments").insert({
    id: assignmentId, cohort_id: cohortId, test_id: testDeveloperId, tester_id: tester.id, status: "active"
  }), "seed active assignment");
  must(await admin.from("feedback").insert({
    id: feedbackId, assignment_id: assignmentId, tester_id: tester.id,
    body: "Storage API integration fixture feedback with sufficient length."
  }), "seed feedback");
  must(await admin.from("support_tickets").insert([
    { id: ticketId, user_id: tester.id, requester_role: "tester", subject: "Storage API test ticket", category: "technical", description: "Fixture ticket for Storage API integration coverage.", status: "open" },
    { id: closedTicketId, user_id: tester.id, requester_role: "tester", subject: "Closed Storage API ticket", category: "technical", description: "Closed fixture ticket must reject new uploads.", status: "closed" }
  ]), "seed support tickets");
  must(await admin.from("reports").insert({
    id: reportId, reporter_id: tester.id, assignment_id: assignmentId,
    report_type: "other", description: "Storage API evidence integration fixture."
  }), "seed report");

  // Support attachments: owner upload/download, cross-user read/write denial,
  // closed-ticket denial, bucket MIME and size enforcement.
  const supportPath = `${ticketId}/${tester.id}/support-${suffix}.txt`;
  const supportUpload = await upload(tester.client, "support-attachments", supportPath, new Blob(["support evidence"], { type: "text/plain" }));
  must(supportUpload, "authorized support upload");
  check(Boolean(must(await download(tester.client, "support-attachments", supportPath), "authorized support download")), "ticket owner downloads support attachment");
  await expectDenied(download(outsider.client, "support-attachments", supportPath), "unrelated user cannot download support attachment");
  await expectDenied(upload(outsider.client, "support-attachments", `${ticketId}/${outsider.id}/forged.txt`, new Blob(["forged"], { type: "text/plain" })), "unrelated user cannot upload to another user's ticket");
  await expectDenied(upload(tester.client, "support-attachments", `${closedTicketId}/${tester.id}/closed.txt`, new Blob(["closed"], { type: "text/plain" })), "closed ticket rejects new attachment upload");
  await expectDenied(upload(tester.client, "support-attachments", `${ticketId}/${tester.id}/wrong-mime.html`, new Blob(["html"], { type: "text/html" }), "text/html"), "support bucket rejects disallowed MIME type");
  await expectDenied(upload(tester.client, "support-attachments", `${ticketId}/${tester.id}/too-large.txt`, new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "text/plain" })), "support bucket rejects files larger than 10 MiB");

  const supportMessageId = id();
  must(await tester.client.from("support_ticket_messages").insert({
    id: supportMessageId, ticket_id: ticketId, sender_id: tester.id, body: "Storage API support attachment message."
  }), "insert support message as ticket owner");
  must(await tester.client.from("support_ticket_attachments").insert({
    ticket_id: ticketId, message_id: supportMessageId, uploaded_by: tester.id,
    storage_path: supportPath, original_filename: "support.txt", mime_type: "text/plain", size_bytes: 15
  }), "insert support attachment metadata as ticket owner");

  // Developer feedback attachments: tester uploads; tester and owning developer
  // can download; an unrelated account cannot read or upload.
  const feedbackPath = `${feedbackId}/${tester.id}/feedback-${suffix}.txt`;
  must(await upload(tester.client, "developer-feedback-attachments", feedbackPath, new Blob(["feedback evidence"], { type: "text/plain" })), "authorized feedback upload");
  check(Boolean(must(await download(developer.client, "developer-feedback-attachments", feedbackPath), "developer feedback download")), "owning developer downloads feedback attachment");
  await expectDenied(download(outsider.client, "developer-feedback-attachments", feedbackPath), "unrelated user cannot download feedback attachment");
  await expectDenied(upload(outsider.client, "developer-feedback-attachments", `${feedbackId}/${outsider.id}/forged.txt`, new Blob(["forged"], { type: "text/plain" })), "unrelated user cannot upload feedback attachment");

  const feedbackMessageId = id();
  must(await tester.client.from("developer_feedback_messages").insert({
    id: feedbackMessageId, feedback_id: feedbackId, sender_id: tester.id, body: "Storage API feedback attachment message."
  }), "insert feedback message as participant");
  must(await tester.client.from("developer_feedback_attachments").insert({
    feedback_id: feedbackId, message_id: feedbackMessageId, uploaded_by: tester.id,
    storage_path: feedbackPath, original_filename: "feedback.txt", mime_type: "text/plain", size_bytes: 17
  }), "insert feedback attachment metadata as participant");

  // Test evidence: the reporter uploads to the canonical test/tester/report/file
  // path; reporter and owning developer can read; unrelated users cannot.
  const fileId = id();
  const evidencePath = `${testDeveloperId}/${tester.id}/${reportId}/${fileId}.txt`;
  must(await upload(tester.client, "test-evidence", evidencePath, new Blob(["report evidence"], { type: "text/plain" })), "authorized report evidence upload");
  check(Boolean(must(await download(developer.client, "test-evidence", evidencePath), "developer evidence download")), "owning developer downloads report evidence");
  check(Boolean(must(await download(tester.client, "test-evidence", evidencePath), "reporter evidence download")), "reporting tester downloads report evidence");
  await expectDenied(download(outsider.client, "test-evidence", evidencePath), "unrelated user cannot download report evidence");
  await expectDenied(upload(outsider.client, "test-evidence", `${testDeveloperId}/${outsider.id}/${reportId}/${id()}.txt`, new Blob(["forged"], { type: "text/plain" })), "unrelated user cannot upload report evidence");
  await expectDenied(upload(tester.client, "test-evidence", `${testDeveloperId}/${tester.id}/${reportId}/${id()}.html`, new Blob(["html"], { type: "text/html" }), "text/html"), "test evidence bucket rejects disallowed extension or MIME");

  must(await tester.client.from("report_attachments").insert({
    report_id: reportId, assignment_id: assignmentId, test_id: testDeveloperId,
    tester_id: tester.id, file_id: fileId, file_extension: "txt", original_filename: "evidence.txt"
  }), "insert report attachment metadata as reporter");

  const signed = must(await tester.client.storage.from("support-attachments").createSignedUrl(supportPath, 60), "create authorized signed URL");
  check(typeof signed.signedUrl === "string" && signed.signedUrl.length > 0, "authorized participant can create a short-lived signed URL");
  await expectDenied(outsider.client.storage.from("support-attachments").createSignedUrl(supportPath, 60), "unrelated user cannot mint a signed URL");

  process.stdout.write(`Storage API regression passed: ${checks} assertions.\n`);
} finally {
  // Remove test objects and fixture users from this disposable local stack.
  for (const bucket of ["support-attachments", "developer-feedback-attachments", "test-evidence"]) {
    const paths = uploaded.filter(item => item.bucket === bucket).map(item => item.path);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
  }
  for (const userId of createdUsers.reverse()) {
    await admin.auth.admin.deleteUser(userId);
  }
}
