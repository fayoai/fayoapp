const fail=(c,status,error)=>c.json({ok:false,error},status);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const num=v=>Number(v)||0;
export function recommendBusinessActions(summary){
 const r=[];
 if(num(summary.invoices_due)>0)r.push({id:'receivables',severity:'high',ar:'توجد فواتير مستحقة تحتاج متابعة التحصيل.',en:'Follow up on overdue customer invoices.'});
 if(num(summary.stock_low)>0)r.push({id:'stock',severity:'medium',ar:'راجع الأرصدة المنخفضة للأصناف بالمستودعات.',en:'Review items with low warehouse stock.'});
 if(num(summary.tasks_due)>0)r.push({id:'tasks',severity:'medium',ar:'لديك مهام متأخرة تحتاج إعادة جدولة أو إنجاز.',en:'Review overdue tasks and reschedule where needed.'});
 if(num(summary.crm_open)>0&&num(summary.crm_won)===0)r.push({id:'pipeline',severity:'low',ar:'راجع فرص المبيعات المفتوحة وتقدمها في المراحل.',en:'Review open sales opportunities and pipeline stages.'});
 if(!r.length)r.push({id:'ready',severity:'info',ar:'لا توجد تنبيهات وفق القواعد الأساسية الحالية.',en:'No alerts from the current basic business rules.'});
 return r;
}
export function installRawiInsights(app,{db,query}){
 app.get('/api/admin/erp/w/:workspace/insights',async c=>{
  const sql=db(c),workspace=c.req.param('workspace'),user=c.get('adminId');
  if(!sql)return fail(c,503,'Database is not configured');
  if(!uuid.test(workspace))return fail(c,400,'Invalid organization');
  const membership=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,user]);
  if(!membership.length)return fail(c,404,'Organization not found');
  const rows=await query(sql,`SELECT
   (SELECT count(*)::int FROM erp_contacts WHERE workspace_id=$1 AND kind='customer') customers,
   (SELECT count(*)::int FROM erp_contacts WHERE workspace_id=$1 AND kind='vendor') vendors,
   (SELECT count(*)::int FROM erp_invoices WHERE workspace_id=$1 AND status='issued' AND due_on IS NOT NULL AND due_on<CURRENT_DATE) invoices_due,
   (SELECT coalesce(sum(total_halalas),0)::bigint FROM erp_invoices WHERE workspace_id=$1 AND status='issued') receivables_halalas,
   (SELECT coalesce(sum(total_halalas),0)::bigint FROM erp_invoices WHERE workspace_id=$1 AND status='paid') paid_invoices_halalas,
   (SELECT count(*)::int FROM erp_stock WHERE workspace_id=$1 AND quantity<=5) stock_low,
   (SELECT count(*)::int FROM erp_tasks WHERE workspace_id=$1 AND status='pending' AND due_at<now()) tasks_due,
   (SELECT count(*)::int FROM rawi_opportunities WHERE workspace_id=$1 AND status='open') crm_open,
   (SELECT count(*)::int FROM rawi_opportunities WHERE workspace_id=$1 AND status='won') crm_won,
   (SELECT coalesce(sum(total_halalas),0)::bigint FROM erp_documents WHERE workspace_id=$1 AND kind='sale' AND status IN ('confirmed','completed')) sales_halalas,
   (SELECT coalesce(sum(total_halalas),0)::bigint FROM erp_documents WHERE workspace_id=$1 AND kind='purchase' AND status IN ('confirmed','completed')) purchases_halalas,
   (SELECT coalesce(sum(amount_halalas),0)::bigint FROM rawi_payments WHERE workspace_id=$1 AND direction='incoming') receipts_halalas,
   (SELECT coalesce(sum(amount_halalas),0)::bigint FROM rawi_payments WHERE workspace_id=$1 AND direction='outgoing') payments_halalas,
   (SELECT count(*)::int FROM erp_employees WHERE workspace_id=$1 AND status='active') active_employees,
   (SELECT count(*)::int FROM erp_projects WHERE workspace_id=$1 AND status='active') active_projects`,[workspace]);
  const data=rows[0]||{},recommendations=recommendBusinessActions(data);
  return c.json({ok:true,data,recommendations,source:'authorized-postgresql-aggregates',updated_at:new Date().toISOString(),note:'Read-only business indicators; not a full statutory financial report'});
 });
}
