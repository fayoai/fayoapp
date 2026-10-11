import {z} from 'zod';
const field=z.object({name:z.string().regex(/^[a-z][a-z0-9_]{1,38}$/),label:z.string().trim().min(1).max(90),type:z.enum(['Char','Text','Integer','Float','Boolean','Date','Datetime'])});
export const moduleInput=z.object({
 technical_name:z.string().regex(/^[a-z][a-z0-9_]{2,48}$/),
 display_name:z.string().trim().min(3).max(100),
 model_name:z.string().regex(/^[a-z][a-z0-9_]{2,38}$/),
 odoo_version:z.enum(['17','18','19','20']),
 fields:z.array(field).min(1).max(20).refine(a=>new Set(a.map(x=>x.name)).size===a.length,'Fields must be unique').refine(a=>!a.some(x=>x.name==='name'),'Use the built-in record name field')
});
const quote=s=>JSON.stringify(s).replace(/\u2028|\u2029/g,' ');
const xml=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const encoder=new TextEncoder();
function zipStore(entries){
 const local=[],central=[];let offset=0;
 const push16=(arr,n)=>{arr.push(n&255,(n>>>8)&255)};
 const push32=(arr,n)=>{arr.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255)};
 const crc32=b=>{let crc=0xffffffff;for(const x of b){crc^=x;for(let k=0;k<8;k++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}return (crc^0xffffffff)>>>0};
 for(const [name,body] of entries){
  const n=encoder.encode(name),data=encoder.encode(body),crc=crc32(data),loc=[];
  push32(loc,0x04034b50);push16(loc,20);push16(loc,0x0800);push16(loc,0);
  push16(loc,0);push16(loc,0);push32(loc,crc);push32(loc,data.length);push32(loc,data.length);push16(loc,n.length);push16(loc,0);
  local.push(new Uint8Array(loc),n,data);
  const ctr=[];push32(ctr,0x02014b50);push16(ctr,20);push16(ctr,20);push16(ctr,0x0800);push16(ctr,0);
  push16(ctr,0);push16(ctr,0);push32(ctr,crc);push32(ctr,data.length);push32(ctr,data.length);push16(ctr,n.length);push16(ctr,0);push16(ctr,0);push16(ctr,0);push16(ctr,0);push32(ctr,0);push32(ctr,offset);
  central.push(new Uint8Array(ctr),n);offset+=loc.length+n.length+data.length;
 }
 const centralSize=central.reduce((a,x)=>a+x.length,0),end=[];
 push32(end,0x06054b50);push16(end,0);push16(end,0);push16(end,entries.length);push16(end,entries.length);push32(end,centralSize);push32(end,offset);push16(end,0);
 const arrays=[...local,...central,new Uint8Array(end)],size=offset+centralSize+end.length,result=new Uint8Array(size);let position=0;
 for(const arr of arrays){result.set(arr,position);position+=arr.length}
 return result;
}
export function buildOdooModule(input){
 const parsed=moduleInput.safeParse(input);
 if(!parsed.success)throw new Error('Invalid Odoo module or fields');
 const x=parsed.data,mod=x.technical_name,model=mod+'.'+x.model_name;
 const className=x.model_name.split('_').map(s=>s[0].toUpperCase()+s.slice(1)).join('');
 const fieldDefs=x.fields.map(f=>'    '+f.name+' = fields.'+f.type+'(string='+quote(f.label)+')').join('\n');
 const columns=['name',...x.fields.map(f=>f.name)];
 const tree=x.odoo_version==='17'?'tree':'list',menuTitle=xml(x.display_name),id='view_'+mod+'_'+x.model_name;
 const xmlView=`<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <record id="${id}_list" model="ir.ui.view">
    <field name="name">${xml(model)}.list</field>
    <field name="model">${xml(model)}</field>
    <field name="arch" type="xml">
      <${tree} string="${menuTitle}">${columns.map(name=>'\n        <field name="'+name+'"/>').join('')}
      </${tree}>
    </field>
  </record>
  <record id="${id}_form" model="ir.ui.view">
    <field name="name">${xml(model)}.form</field>
    <field name="model">${xml(model)}</field>
    <field name="arch" type="xml">
      <form string="${menuTitle}">
        <sheet><group>${columns.map(name=>'\n          <field name="'+name+'"/>').join('')}
        </group></sheet>
      </form>
    </field>
  </record>
  <record id="action_${mod}" model="ir.actions.act_window">
    <field name="name">${menuTitle}</field>
    <field name="res_model">${xml(model)}</field>
    <field name="view_mode">${tree},form</field>
  </record>
  <menuitem id="menu_${mod}_root" name="${menuTitle}" sequence="10"/>
  <menuitem id="menu_${mod}_records" name="${menuTitle}" parent="menu_${mod}_root" action="action_${mod}" sequence="10"/>
</odoo>
`;
 const manifest=`# -*- coding: utf-8 -*-
{
    'name': ${quote(x.display_name)},
    'version': '${x.odoo_version}.0.1.0.0',
    'summary': ${quote('Generated basic Odoo business module')},
    'category': 'Tools',
    'depends': ['base'],
    'data': ['security/ir.model.access.csv', 'views/records.xml'],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
`;
 const files=[
 [mod+'/__init__.py','from . import models\n'],
 [mod+'/__manifest__.py',manifest],
 [mod+'/models/__init__.py','from . import models\n'],
 [mod+'/models/models.py',`from odoo import models, fields

class ${className}(models.Model):
    _name = ${quote(model)}
    _description = ${quote(x.display_name)}

    name = fields.Char(string="Name", required=True)
${fieldDefs}
`],
 [mod+'/security/ir.model.access.csv',`id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_${mod}_${x.model_name}_user,access_${mod}_${x.model_name}_user,model_${mod}_${x.model_name},base.group_user,1,1,1,0
`],
 [mod+'/views/records.xml',xmlView],
 [mod+'/README.md',`# ${x.display_name}
Generated by RAWI Developers for Odoo ${x.odoo_version}.
This scaffold must be reviewed and tested on a staging Odoo server before installation.
Upload the extracted ${mod} directory to a configured Odoo addons path and update the Apps list.
It does NOT remotely install itself or alter the connected Odoo database.
`]
 ];
 return zipStore(files);
}
