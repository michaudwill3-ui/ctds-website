// Creates a Stripe pay link for an approved membership applicant, emails it to
// them, and notifies the admin. Mirrors the partner pay-link flow.
const SECRET = process.env.STRIPE_SECRET_KEY;
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

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SECRET) { res.status(500).json({ error: "Stripe is not configured yet." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const amount = Math.round(Number(body.amount) * 100);
  const memberId = body.member_id;
  const name = (body.name || "Member").toString().slice(0, 120);
  const email = (body.email || "").toString().trim();
  if (!memberId || !amount || amount < 50) {
    res.status(400).json({ error: "A member and an amount of at least $0.50 are required." });
    return;
  }

  const SITE = "https://www.ctdermatologysociety.net";
  const H = { Authorization: "Bearer " + SECRET, "Content-Type": "application/x-www-form-urlencoded" };

  try {
    var p = new URLSearchParams();
    p.append("currency", "usd");
    p.append("unit_amount", String(amount));
    p.append("product_data[name]", "CTDS Membership Dues - " + name);
    const pr = await fetch("https://api.stripe.com/v1/prices", { method: "POST", headers: H, body: p.toString() });
    const price = await pr.json();
    if (!pr.ok) { res.status(400).json({ error: (price.error && price.error.message) || "Price error" }); return; }

    var l = new URLSearchParams();
    l.append("line_items[0][price]", price.id);
    l.append("line_items[0][quantity]", "1");
    l.append("after_completion[type]", "redirect");
    l.append("after_completion[redirect][url]", SITE + "/welcome.html");
    l.append("metadata[member_id]", memberId);
    const lk = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: H, body: l.toString() });
    const link = await lk.json();
    if (!lk.ok) { res.status(400).json({ error: (link.error && link.error.message) || "Link error" }); return; }

    const url = link.url + "?client_reference_id=member_" + encodeURIComponent(memberId);

    const dollars = "$" + (amount / 100).toFixed(2);
    if (email) {
      const inner = '<p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.65;">Your membership in the Connecticut Dermatology and Dermatologic Surgery Society has been approved. To complete your membership, please pay your dues of <strong>' + dollars + '</strong> using the secure link below.</p><p style="margin:0 0 26px;"><a href="' + url + '" style="display:inline-block;background:#0c2040;color:#fff;text-decoration:none;font-size:14px;padding:12px 22px;border-radius:5px;">Pay membership dues</a></p><p style="margin:0;color:#8a93a3;font-size:12px;line-height:1.6;">If the button does not work, copy and paste this link:<br>' + url + '</p>';
      await send(email, "Complete your CTDS membership (" + dollars + ")", shell("Welcome — complete your membership", "Hello " + name + ",", inner));
    }
    await send(ADMIN, "Member pay link sent: " + name + " (" + dollars + ")", shell("Membership pay link created", name + (email ? " (" + email + ")" : "") + " has been approved and sent a pay link for " + dollars + ".", '<p style="margin:0;color:#374151;font-size:14px;">You can also copy the link from the admin dashboard.</p>'));

    res.status(200).json({ url: url });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
