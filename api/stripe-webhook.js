// Stripe webhook: marks a member or partner paid in Supabase when a checkout completes.
import crypto from "crypto";
export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPA = process.env.SUPABASE_URL || "https://sdqyumtraqwdelvyiqpf.supabase.co";
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sigHeader = req.headers["stripe-signature"] || "";
  const raw = await rawBody(req);

  let t, v1;
  sigHeader.split(",").forEach((kv) => {
    const i = kv.indexOf("=");
    const k = kv.slice(0, i), val = kv.slice(i + 1);
    if (k === "t") t = val;
    if (k === "v1") v1 = val;
  });
  if (!whsec || !t || !v1) { res.status(400).send("missing signature"); return; }
  const expected = crypto.createHmac("sha256", whsec).update(t + "." + raw.toString("utf8")).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { res.status(400).send("bad signature"); return; }

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch (e) { res.status(400).send("bad json"); return; }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object || {};
    const cref = s.client_reference_id || "";
    let table, filter, patch;
    if (cref.indexOf("partner_") === 0) {
      table = "partners";
      filter = "id=eq." + encodeURIComponent(cref.slice(8));
      patch = { payment_status: "paid", paid_at: new Date().toISOString(), status: "paid" };
    } else {
      table = "members";
      const email = s.customer_email || (s.customer_details && s.customer_details.email);
      filter = cref ? "id=eq." + encodeURIComponent(cref) : (email ? "email=eq." + encodeURIComponent(email) : null);
      patch = { payment_status: "paid", paid_at: new Date().toISOString(), status: "active" };
    }
    if (filter && KEY) {
      try {
        await fetch(SUPA + "/rest/v1/" + table + "?" + filter, {
          method: "PATCH",
          headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
      } catch (e) { /* Stripe retries on non-200 */ }
    }
  }
  res.status(200).json({ received: true });
}
