const digestBytes=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
export function evaluationSettings(env={}){
 const days=Number(env.RAWI_TRIAL_DAYS||7),limit=Number(env.RAWI_TRIAL_MESSAGE_LIMIT||30);
 if(!Number.isInteger(days)||days<1||days>30||!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Invalid RAWI trial settings');
 return {days,limit,code:'rawi-evaluation'};
}
export async function enforceAuthLimit(sql,query,secret,ip,bucket,identity=''){
 if(!secret||secret.length<32)throw new Error('Secure session secret is required');
 if(!['registration','login'].includes(bucket))throw new Error('Invalid auth rate limit');
 const host=String(ip||'unknown').slice(0,100),id=String(identity||'').trim().toLowerCase().slice(0,180);
 const digest=await digestBytes(secret+'|rawi-auth|'+bucket+'|'+host+'|'+id);
 const interval=bucket==='registration'?'1 hour':'15 minutes',ceiling=bucket==='registration'?5:12;
 // UPSERT increments atomically even if simultaneous requests arrive.
 const rows=await query(sql,`INSERT INTO rawi_auth_rate_limits(client_key,bucket,hits,expires_at)
 VALUES($1,$2,1,now()+$3::interval)
 ON CONFLICT(client_key,bucket) DO UPDATE
 SET hits=CASE WHEN rawi_auth_rate_limits.expires_at<=now() THEN 1 ELSE rawi_auth_rate_limits.hits+1 END,
 expires_at=CASE WHEN rawi_auth_rate_limits.expires_at<=now() THEN now()+$3::interval ELSE rawi_auth_rate_limits.expires_at END
 RETURNING hits,expires_at`,[digest,bucket,interval]);
 return {allowed:Number(rows[0]?.hits||0)<=ceiling,retry_at:rows[0]?.expires_at||null};
}
export async function ensureEvaluationPlan(sql,query,settings,accountType='enterprise'){
 if(!['enterprise','developer'].includes(accountType))throw new Error('Unsupported RAWI product');
 const product=accountType==='developer'?'RAWI-DEVELOPERS':'RAWI-AI-ERP';
 const code=accountType==='developer'?'rawi-developers-evaluation':'rawi-evaluation';
 const title=accountType==='developer'?'RAWI Developers evaluation':'RAWI Enterprise evaluation';
 const rows=await query(sql,`INSERT INTO mif_subscription_plans(code,title,cycle,price_halalas,message_limit,active,product_code)
 VALUES($1,$2,'monthly',0,$3,true,$4)
 ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code
 RETURNING id,active,message_limit,product_code`,[code,title,settings.limit,product]);
 if(!rows[0]?.active)throw new Error('Evaluation plan is currently disabled by platform operator');
 return rows[0];
}
