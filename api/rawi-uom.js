import {z} from 'zod';

const id=z.string().uuid();
const fail=(c,status,error)=>c.json({ok:false,error},status);
const parse=async c=>{try{return await c.req.json()}catch{return {}}};
const unitInput=z.object({
 code:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{0,19}$/),
 name:z.string().trim().min(2).max(90),
 category:z.enum(['count','weight','volume','length','area','time','other']).default('count'),
 precision_digits:z.number().int().min(0).max(6).default(3),
 active:z.boolean().default(true)
}).strict();
const productUnitInput=z.object({
 unit_id:id,
 factor:z.number().positive().max(1000000000),
 barcode:z.string().trim().max(90).default(''),
 sale_price:z.number().min(0).max(100000000).nullable().default(null),
 purchase_price:z.number().min(0).max(100000000).nullable().default(null)
}).strict();
const minor=value=>value===null?null:Math.round(value*100);
export function unitsToBase(quantity,factor){
 const value=Number(quantity)*Number(factor);
 if(!Number.isFinite(value)||Math.abs(value)>1000000000||Math.abs(Math.round(value*1000)-value*1000)>0.000001)
  throw Error('الكمية بعد التحويل يجب ألا تتجاوز 3 منازل عشرية');
 return Math.round(value*1000)/1000;
}
export async function resolveItemUnit({sql,query,workspace,itemId,unitId,quantity}){
 const rows=await query(sql,"SELECT i.id,i.unit,i.sale_price_halalas,i.cost_halalas,l.factor,l.sale_price_halalas unit_sale_halalas,l.purchase_price_halalas unit_purchase_halalas,u.name unit_name,u.code unit_code FROM erp_items i LEFT JOIN erp_item_units l ON l.workspace_id=i.workspace_id AND l.item_id=i.id AND (($3::uuid IS NULL AND l.is_base=true) OR l.unit_id=$3) LEFT JOIN erp_units u ON u.id=l.unit_id AND u.workspace_id=i.workspace_id WHERE i.workspace_id=$1 AND i.id=$2 AND i.active=true AND ($3::uuid IS NULL OR l.unit_id=$3)",
 [workspace,itemId,unitId||null]);
 const selected=rows[0];
 if(!selected)throw Error('الصنف أو وحدة القياس غير موجودين في الشركة');
 if(unitId&&!selected.unit_code)throw Error('وحدة القياس غير مرتبطة بهذا الصنف');
 const factor=unitId?Number(selected.factor):1;
 const baseQuantity=unitsToBase(quantity,factor);
 return {baseQuantity,factor,unit_code:selected.unit_code||selected.unit,
  sale_price_halalas: selected.unit_sale_halalas==null?Math.round(Number(selected.sale_price_halalas)*factor):Number(selected.unit_sale_halalas),
  purchase_price_halalas:selected.unit_purchase_halalas==null?Math.round(Number(selected.cost_halalas)*factor):Number(selected.unit_purchase_halalas)};
}
export function installRawiUom(app,{db,env,query}){
 async function gate(c,write=false){
  if(env(c).MIF_APP_SURFACE!=='enterprise')return {error:fail(c,404,'Not found')};
  const sql=db(c),workspace=c.req.param('workspace'),actor=c.get('adminId');
  if(!sql||!id.safeParse(workspace).success)return {error:fail(c,503,'Company database unavailable')};
  const roles=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,actor]);
  if(!roles.length)return {error:fail(c,404,'Company not found')};
  if(write&&roles[0].role==='viewer')return {error:fail(c,403,'Read-only access')};
  return {sql,workspace,actor,role:roles[0].role};
 }
 app.get('/api/admin/erp/w/:workspace/system/units',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const data=await query(g.sql,'SELECT id,code,name,category,precision_digits,active FROM erp_units WHERE workspace_id=$1 ORDER BY category,code',[g.workspace]);
  return c.json({ok:true,data});
 });
 app.post('/api/admin/erp/w/:workspace/system/units',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=unitInput.safeParse(await parse(c));if(!v.success)return fail(c,400,'Invalid unit');
  const x=v.data;
  const found=await query(g.sql,"INSERT INTO erp_units(workspace_id,code,name,category,precision_digits,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,code) DO NOTHING RETURNING id,code,name,category,precision_digits,active",[g.workspace,x.code,x.name,x.category,x.precision_digits,x.active]);
  return found.length?c.json({ok:true,data:found[0]},201):fail(c,409,'This unit code already exists');
 });
 app.patch('/api/admin/erp/w/:workspace/system/units/:unitId',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const unitId=c.req.param('unitId');
  if(!id.safeParse(unitId).success)return fail(c,400,'Invalid unit');
  const v=z.object({name:z.string().trim().min(2).max(90),active:z.boolean()}).strict().safeParse(await parse(c));
  if(!v.success)return fail(c,400,'Invalid unit settings');
  const updated=await query(g.sql,"UPDATE erp_units SET name=$3,active=$4 WHERE workspace_id=$1 AND id=$2 RETURNING id,code,name,category,precision_digits,active",[g.workspace,unitId,v.data.name,v.data.active]);
  return updated.length?c.json({ok:true,data:updated[0]}):fail(c,404,'Unit not found');
 });
 app.get('/api/admin/erp/w/:workspace/system/items/:itemId/units',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const itemId=c.req.param('itemId');if(!id.safeParse(itemId).success)return fail(c,400,'Invalid product');
  const product=await query(g.sql,'SELECT id,sku,name,unit FROM erp_items WHERE workspace_id=$1 AND id=$2',[g.workspace,itemId]);
  if(!product.length)return fail(c,404,'Product not found');
  const linked=await query(g.sql,"SELECT l.unit_id,u.code,u.name,u.category,l.factor,l.is_base,l.barcode,l.sale_price_halalas,l.purchase_price_halalas FROM erp_item_units l JOIN erp_units u ON u.workspace_id=l.workspace_id AND u.id=l.unit_id WHERE l.workspace_id=$1 AND l.item_id=$2 ORDER BY l.is_base DESC,u.name",[g.workspace,itemId]);
  return c.json({ok:true,product:product[0],data:linked.map(x=>({...x,factor:Number(x.factor),sale_price:x.sale_price_halalas==null?null:Number(x.sale_price_halalas)/100,purchase_price:x.purchase_price_halalas==null?null:Number(x.purchase_price_halalas)/100}))});
 });
 app.put('/api/admin/erp/w/:workspace/system/items/:itemId/units',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const itemId=c.req.param('itemId');if(!id.safeParse(itemId).success)return fail(c,400,'Invalid product');
  const v=productUnitInput.safeParse(await parse(c));if(!v.success)return fail(c,400,'Invalid product unit conversion');
  const item=await query(g.sql,"SELECT id,unit FROM erp_items WHERE workspace_id=$1 AND id=$2",[g.workspace,itemId]);
  if(!item.length)return fail(c,404,'Product not found');
  const unit=await query(g.sql,"SELECT id,code,category,active FROM erp_units WHERE workspace_id=$1 AND id=$2",[g.workspace,v.data.unit_id]);
  if(!unit.length||!unit[0].active)return fail(c,404,'Unit unavailable');
  const base=await query(g.sql,"SELECT u.category,u.code FROM erp_item_units l JOIN erp_units u ON u.id=l.unit_id AND u.workspace_id=l.workspace_id WHERE l.workspace_id=$1 AND l.item_id=$2 AND l.is_base=true",[g.workspace,itemId]);
  if(base.length&&base[0].category!==unit[0].category)return fail(c,409,'Unit category must match the product base unit');
  const isBase=unit[0].code===item[0].unit;
  if(isBase&&v.data.factor!==1)return fail(c,400,'Base unit conversion must equal 1');
  if(!isBase&&!base.length)return fail(c,409,'Create or select the product base unit first');
  const x=v.data;
  const saved=await query(g.sql,"INSERT INTO erp_item_units(workspace_id,item_id,unit_id,factor,is_base,barcode,sale_price_halalas,purchase_price_halalas) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,item_id,unit_id) DO UPDATE SET factor=EXCLUDED.factor,barcode=EXCLUDED.barcode,sale_price_halalas=EXCLUDED.sale_price_halalas,purchase_price_halalas=EXCLUDED.purchase_price_halalas RETURNING item_id,unit_id,factor,is_base,barcode",
  [g.workspace,itemId,x.unit_id,x.factor,isBase,x.barcode,minor(x.sale_price),minor(x.purchase_price)]);
  return c.json({ok:true,data:{...saved[0],factor:Number(saved[0].factor)}});
 });
}
