// Creates a Stripe Payment Link for a specific dollar amount for an approved partner.
// Secret key from Vercel env STRIPE_SECRET_KEY. Returns { url }.
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const SECRET = process.env.STRIPE_SECRET_KEY;
  if (!SECRET) { res.status(500).json({ error: "Stripe is not configured yet." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const amount = Math.round(Number(body.amount) * 100);
  const partnerId = body.partner_id;
  const company = (body.company || "Partnership").toString().slice(0, 120);
  if (!partnerId || !amount || amount < 50) {
    res.status(400).json({ error: "A partner and an amount of at least $0.50 are required." });
    return;
  }

  const SITE = "https://www.ctdermatologysociety.net";
  const H = { Authorization: "Bearer " + SECRET, "Content-Type": "application/x-www-form-urlencoded" };

  try {
    var p = new URLSearchParams();
    p.append("currency", "usd");
    p.append("unit_amount", String(amount));
    p.append("product_data[name]", "CTDS Partnership - " + company);
    const pr = await fetch("https://api.stripe.com/v1/prices", { method: "POST", headers: H, body: p.toString() });
    const price = await pr.json();
    if (!pr.ok) { res.status(400).json({ error: (price.error && price.error.message) || "Price error" }); return; }

    var l = new URLSearchParams();
    l.append("line_items[0][price]", price.id);
    l.append("line_items[0][quantity]", "1");
    l.append("after_completion[type]", "redirect");
    l.append("after_completion[redirect][url]", SITE + "/welcome.html?partner=1");
    l.append("metadata[partner_id]", partnerId);
    const lk = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: H, body: l.toString() });
    const link = await lk.json();
    if (!lk.ok) { res.status(400).json({ error: (link.error && link.error.message) || "Link error" }); return; }

    const url = link.url + "?client_reference_id=partner_" + encodeURIComponent(partnerId);
    res.status(200).json({ url: url });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
