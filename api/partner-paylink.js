export default async function handler(req,res){
  if(req.method!=="POST"){res.status(405).json({error:"Method not allowed"});return;}
  const SECRET=process.env.STRIPE_SECRET_KEY;
  const RESEND=process.env.RESEND_API_KEY;
  const FROM=process.env.FROM_EMAIL||"Connecticut Society of Dermatology <notifications@ctdermatologysociety.net>";
  const ADMIN=process.env.NOTIFY_EMAIL||"ctdermexec@outlook.com";
  if(!SECRET){res.status(500).json({error:"Stripe is not configured yet."});return;}
  let body=req.body;if(typeof body==="string"){try{body=JSON.parse(body);}catch(e){body={};}}body=body||{};
  const amount=Math.round(Number(body.amount)*100);
  const partnerId=body.partner_id;
  const company=(body.company||"Partnership").toString().slice(0,120);
  const email=body.email;
  if(!partnerId||!amount||amount<50){res.status(400).json({error:"A partner and an amount of at least $0.50 are required."});return;}
  const SITE="https://www.ctdermatologysociety.net";
  const H={Authorization:"Bearer "+SECRET,"Content-Type":"application/x-www-form-urlencoded"};
  function shell(heading,intro,inner){return '<div style="background:#f4f5f7;padding:28px 0;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;"><div style="background:#0c2040;padding:22px 28px;border-bottom:3px solid #e8e0d0;"><div style="color:#fff;font-family:Georgia,serif;font-size:16px;">Connecticut Society of Dermatology</div><div style="color:rgba(255,255,255,.55);font-family:Georgia,serif;font-style:italic;font-size:11px;margin-top:2px;">&amp; Dermatologic Surgery</div></div><div style="padding:30px 28px;"><h1 style="margin:0 0 10px;color:#0c2040;font-family:Georgia,serif;font-size:21px;font-weight:normal;">'+heading+'</h1>'+(intro?'<p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.65;">'+intro+'</p>':'')+inner+'</div><div style="background:#f8f7f4;padding:18px 28px;border-top:1px solid #eef0f3;"><p style="margin:0;color:#8a93a3;font-size:11px;line-height:1.7;">Connecticut Society of Dermatology and Dermatologic Surgery &middot; (860) 810-0931 &middot; ctdermexec@outlook.com</p></div></div></div>';}
  async function send(to,subject,html){if(!RESEND||!to)return;const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+RESEND,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[to],subject,html,reply_to:ADMIN})});if(!r.ok)console.error("Resend",r.status,await r.text());}
  try{
    var p=new URLSearchParams();p.append("currency","usd");p.append("unit_amount",String(amount));p.append("product_data[name]","CTDS Partnership - "+company);
    const pr=await fetch("https://api.stripe.com/v1/prices",{method:"POST",headers:H,body:p.toString()});const price=await pr.json();
    if(!pr.ok){res.status(400).json({error:(price.error&&price.error.message)||"Price error"});return;}
    var l=new URLSearchParams();l.append("line_items[0][price]",price.id);l.append("line_items[0][quantity]","1");l.append("after_completion[type]","redirect");l.append("after_completion[redirect][url]",SITE+"/welcome.html?partner=1");l.append("metadata[partner_id]",partnerId);
    const lk=await fetch("https://api.stripe.com/v1/payment_links",{method:"POST",headers:H,body:l.toString()});const link=await lk.json();
    if(!lk.ok){res.status(400).json({error:(link.error&&link.error.message)||"Link error"});return;}
    const url=link.url+"?client_reference_id=partner_"+encodeURIComponent(partnerId);
    const amt="$"+(amount/100).toFixed(2);
    if(email){const inner='<p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.65;">Your partnership with the Connecticut Society of Dermatology has been approved. The amount due is <strong>'+amt+'</strong>. Please complete your payment securely below.</p><p style="margin:0 0 6px;"><a href="'+url+'" style="display:inline-block;background:#0c2040;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-size:13px;font-weight:600;">Pay '+amt+' securely</a></p><p style="margin:16px 0 0;color:#8a93a3;font-size:12px;word-break:break-all;">Or paste this link: '+url+'</p>';await send(email,"Your CTDS partnership payment link ("+amt+")",shell("Partnership approved",null,inner));}
    await send(ADMIN,"Charge sent to sponsor: "+company+" ("+amt+")",shell("Charge assigned","You assigned a "+amt+" charge to "+company+(email?(" and emailed the payment link to "+email):"")+".",'<p style="margin:0;color:#374151;font-size:14px;">You&rsquo;ll get another email when they pay.</p>'));
    res.status(200).json({url:url});
  }catch(e){res.status(500).json({error:String(e)});}
}
