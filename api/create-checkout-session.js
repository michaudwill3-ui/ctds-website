// Creates a $250 one-time Stripe Checkout session for CTDS regular membership dues.
// Secret key is read from the Vercel env var STRIPE_SECRET_KEY (never in the repo).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const SECRET = process.env.STRIPE_SECRET_KEY;
  if (!SECRET) {
    res.status(500).json({ error: "Stripe is not configured yet." });
    return;
  }

  const PRICE_ID = "price_1UHqwmCmGQHLkfwg0AQIgQDQ";
  const SITE = "https://www.ctdermatologysociety.net";

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("line_items[0][price]", PRICE_ID);
  params.append("line_items[0][quantity]", "1");
  params.append("success_url", SITE + "/welcome.html?paid=1&session_id={CHECKOUT_SESSION_ID}");
  params.append("cancel_url", SITE + "/dashboard.html?canceled=1");
  if (body.email) params.append("customer_email", body.email);
  if (body.uid) params.append("client_reference_id", body.uid);

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + SECRET,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(400).json({ error: (data.error && data.error.message) || "Stripe error" });
      return;
    }
    res.status(200).json({ url: data.url });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
