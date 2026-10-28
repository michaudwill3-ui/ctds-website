import crypto from "crypto";
export const config={api:{bodyParser:false}};
const RESEND=process.env.RESEND_API_KEY;
const FROM=process.env.FROM_EMAIL||"Connecticut Society of Dermatology <notifications@ctdermatologysociety.net>";
const ADMIN=process.env.NOTIFY_EMAIL||"ctdermexec@outlook.com";
function rawBody(req){return new Promise((rs,rj)=>{const c=[];req.on("data",x=>c.push(x));req.on("end",()=>rs(Buffer.concat(c)));req.on("error",rj);});}
function shell(heading,intro,inner){return '<div style="background:#f4f5f7;padding:28px 0;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;"><div style="background:#0c2040;padding:22px 28px;border-bottom:3px solid #e8e0d0;"><div style="color:#fff;font-family:Georgia,serif;font-size:16px;letter-spacing:.4px;">Connecticut Society of Dermatology</div><div style="color:rgba(255,255,255,.55);font-family:Georgia,serif;font-style:italic;font-size:11px;margin-top:2px;">&amp; Dermatologic Surgery</div></div><div style="padding:30px 28px;"><h1 style="margin:0 0 10px;color:#0c2040;font-family:Georgia,serif;font-size:21px;font-weight:normal;">'+heading+'</h1>'+(intro?'<p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.65;">'+intro+'</p>':'')+inner+'</div><div style="background:#f8f7f4;padding:18px 28px;border-top:1px solid #eef0f3;"><p style="margin:0;color:#8a93a3;font-size:11px;line-height:1.7;">Connecticut Society of Dermatology and Dermatologic Surgery<br>241 Asylum Street, Unit 700 West, Hartford, CT 06103 &nbsp;&middot;&nbsp; (860) 810-0931 &nbsp;&middot;&nbsp; ctdermexec@outlook.com</p></div></div></div>';}
async function send(to,subject,html){if(!RESEND||!to)return;const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+RESEND,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[to],subject,html})});if(!r.ok)console.error("Resend",r.status,await r.text());}
function money(cents){return "$"+((cents||0)/100).toFixed(2);}
export default async function handler(req,res){
  if(req.method!=="POST"){res.status(405).end();return;}
  const whsec=process.env.STRIPE_WEBHOOK_SECRET;
  const SUPA=process.env.SUPABASE_URL||"https://sdqyumtraqwdelvyiqpf.supabase.co";
  const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sig=req.headers["stripe-signature"]||"";const raw=await rawBody(req);
  let t,v1;sig.split(",").forEach(kv=>{const i=kv.indexOf("=");const k=kv.slice(0,i),val=kv.slice(i+1);if(k==="t")t=val;if(k==="v1")v1=val;});
  if(!whsec||!t||!v1){res.status(400).send("missing signature");return;}
  const exp=crypto.createHmac("sha256",whsec).update(t+"."+raw.toString("utf8")).digest("hex");
  const a=Buffer.from(exp),b=Buffer.from(v1);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)){res.status(400).send("bad signature");return;}
  let event;try{event=JSON.parse(raw.toString("utf8"));}catch(e){res.status(400).send("bad json");return;}
  if(event.type==="checkout.session.completed"){
    const s=event.data.object||{};
    const cref=s.client_reference_id||"";
    const email=s.customer_email||(s.customer_details&&s.customer_details.email);
    const amt=money(s.amount_total);
    let table,filter,patch,isPartner=false;
    if(cref.indexOf("partner_")===0){isPartner=true;table="partners";filter="id=eq."+encodeURIComponent(cref.slice(8));patch={payment_status:"paid",paid_at:new Date().toISOString(),status:"paid"};}
    else{table="members";filter=cref?"id=eq."+encodeURIComponent(cref):(email?"email=eq."+encodeURIComponent(email):null);patch={payment_status:"paid",paid_at:new Date().toISOString(),status:"active"};}
    if(filter&&KEY){try{await fetch(SUPA+"/rest/v1/"+table+"?"+filter,{method:"PATCH",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(patch)});}catch(e){}}
    const receiptInner='<div style="background:#eef5ee;border:1px solid #bcd9c0;border-radius:8px;padding:16px 18px;color:#24603a;font-size:15px;"><strong>Payment received: '+amt+'</strong></div><p style="margin:18px 0 0;color:#374151;font-size:14px;line-height:1.65;">Thank you. This confirms your payment to the Connecticut Society of Dermatology and Dermatologic Surgery. A Stripe receipt has also been sent to this address.</p>';
    if(email)await send(email,"Payment received — CTDS ("+amt+")",shell("Payment confirmed",null,receiptInner));
    await send(ADMIN,(isPartner?"Sponsor payment received: ":"Member payment received: ")+amt,shell((isPartner?"Sponsor payment received":"Member dues payment received"),(email||"Someone")+" just paid "+amt+".",'<p style="margin:0;color:#374151;font-size:14px;">Recorded as paid in the admin dashboard.</p>'));
  }
  res.status(200).json({received:true});
}
