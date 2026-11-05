// Called by the member_applications INSERT trigger. Confirms to the applicant
// and notifies the admin that a new membership application came in.
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.FROM_EMAIL || "Connecticut Dermatology and Dermatologic Surgery Society <notifications@ctdermatologysociety.net>";
const ADMIN = process.env.NOTIFY_EMAIL || "ctdermexec@outlook.com";

function shell(heading, intro, inner) {
  return '<div style="background:#f4f5f7;padding:28px 0;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;"><div style="background:#0c2040;padding:22px 28px;border-bottom:3px solid #e8e0d0;"><div style="color:#fff;font-family:Georgia,serif;font-size:16px;letter-spacing:.4px;">Connecticut Dermatology</div><div style="color:rgba(255,255,255,.55);font-family:Georgia,serif;font-style:italic;font-size:11px;margin-top:2px;">&amp; Dermatologic Surgery Society</div></div><div style="padding:30px 28px;"><h1 style="margin:0 0 10px;color:#0c2040;font-family:Georgia,serif;font-size:21px;font-weight:normal;">' + heading + '</h1>' + (intro ? '<p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.65;">' + intro + '</p>' : '') + inner + '</div><div style="background:#f8f7f4;padding:18px 28px;border-top:1px solid #eef0f3;"><p style="margin:0;color:#8a93a3;font-size:11px;line-height:1.7;">Connecticut Dermatology and Dermatologic Surgery Society<br>241 Asylum Street, Unit 700 West, Hartford, CT 06103 &nbsp;&middot;&nbsp; (860) 810-0931 &nbsp;&middot;&nbsp; ctdermexec@outlook.com</p></div></div></div>';
}
async function send(to, subject, html) {
  if (!RESEND || !to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
}
function esc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const r = (body && body.record) || {};
  const name = r.full_name || "Applicant";
  const email = (r.email || "").toString().trim();

  if (email) {
    const inner = '<p style="margin:0;color:#374151;font-size:14px;line-height:1.65;">Thank you for applying to join the Connecticut Dermatology and Dermatologic Surgery Society. Your application has been received. The Executive Director will review it and follow up with membership dues and next steps.</p>';
    await send(email, "We received your CTDS membership application", shell("Application received", "Hello " + esc(name) + ",", inner));
  }

  const rows = [
    ["Name", r.full_name], ["Email", r.email], ["Phone", r.phone],
    ["Credentials", r.credentials], ["Membership type", r.membership_type],
    ["Practice", r.practice_name], ["City", r.practice_city],
  ];
  var tbl = '<table style="width:100%;border-collapse:collapse;font-size:14px;">';
  rows.forEach(function (row) {
    if (row[1]) tbl += '<tr><td style="padding:6px 0;color:#8a93a3;width:130px;">' + esc(row[0]) + '</td><td style="padding:6px 0;color:#1a1a1a;">' + esc(row[1]) + '</td></tr>';
  });
  tbl += '</table>';
  await send(ADMIN, "New membership application: " + name, shell("New membership application", "Someone just applied for membership. Review and approve them in the admin dashboard, then send their pay link.", tbl));

  res.status(200).json({ ok: true });
}
