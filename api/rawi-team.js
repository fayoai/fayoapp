import {z} from 'zod';
const uuid=z.string().uuid();
const input=z.object({email:z.email().max(180),role:z.enum(['admin','viewer'])});
const parse=async c=>{try{return await c.req.json()}catch{return {}}};
const bad=(c,status,error)=>c.json({ok:false,error},status);
export function installRawiTeam(app,{db,query}){
 async function gate(c,owner=false){
  const sql=db(c),w=c.req.param('workspace'),actor=c.get('adminId');
  if(!sql)return {error:bad(c,503,'Database unavailable')};
  if(!uuid.safeParse(w).success)return {error:bad(c,400,'Invalid workspace')};
  const memberships=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[w,actor]);
  if(!memberships.length)return {error:bad(c,404,'Workspace not found')};
  if(owner&&memberships[0].role!=='owner')return {error:bad(c,403,'Only the organization owner can manage access')};
  return {sql,w};
 }
 app.get('/api/admin/erp/w/:workspace/members',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const data=await query(g.sql,`SELECT m.admin_id,a.email,m.role FROM erp_memberships m
  JOIN admins a ON a.id=m.admin_id WHERE m.workspace_id=$1 ORDER BY
  CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,a.email`,[g.w]);
  return c.json({ok:true,data});
 });
 app.post('/api/admin/erp/w/:workspace/members',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=input.safeParse(await parse(c));if(!v.success)return bad(c,400,'Invalid team member');
  const x=v.data,rows=await query(g.sql,`INSERT INTO erp_memberships(workspace_id,admin_id,role)
  SELECT $1,a.id,$3 FROM admins a
  JOIN erp_workspaces w ON w.id=$1
  LEFT JOIN rawi_account_profiles invited_type ON invited_type.admin_id=a.id
  LEFT JOIN rawi_account_profiles owner_type ON owner_type.admin_id=w.owner_id
  WHERE a.email=$2 AND COALESCE(invited_type.account_type,'enterprise')=COALESCE(owner_type.account_type,'enterprise')
  ON CONFLICT(workspace_id,admin_id) DO NOTHING RETURNING admin_id`,[g.w,x.email.trim().toLowerCase(),x.role]);
  return rows.length?c.json({ok:true},201):bad(c,409,'User is not registered, already belongs to this organization, or uses a different RAWI product.');
 });
 app.patch('/api/admin/erp/w/:workspace/members/:member',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('member')).success)return bad(c,400,'Invalid member');
  const v=z.object({role:z.enum(['admin','viewer'])}).safeParse(await parse(c));
  if(!v.success)return bad(c,400,'Invalid role');
  const rows=await query(g.sql,`UPDATE erp_memberships SET role=$1
   WHERE workspace_id=$2 AND admin_id=$3 AND role<>'owner' RETURNING admin_id`,[v.data.role,g.w,c.req.param('member')]);
  return rows.length?c.json({ok:true}):bad(c,404,'Member not found or organization owner cannot be modified');
 });
 app.delete('/api/admin/erp/w/:workspace/members/:member',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('member')).success)return bad(c,400,'Invalid member');
  const rows=await query(g.sql,`DELETE FROM erp_memberships
   WHERE workspace_id=$1 AND admin_id=$2 AND role<>'owner' RETURNING admin_id`,[g.w,c.req.param('member')]);
  return rows.length?c.json({ok:true}):bad(c,404,'Member not found or organization owner cannot be removed');
 });
}
