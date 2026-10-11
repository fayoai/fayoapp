import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const url=process.env.DATABASE_URL;
if(!url) throw new Error('DATABASE_URL is required.');
const sql=neon(url);
const schema=readFileSync(new URL('../sql/auth.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/ai-erp.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/erp-core.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/mif-chat.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/mif-platform.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/mif-guest.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/mif-saas.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/mif-website.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/rawi-advanced.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/rawi-chat-isolation.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/rawi-activities.sql',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../sql/rawi-developers.sql',import.meta.url),'utf8');
// Neon HTTP executes one statement per query; split at semicolons that are outside strings.
let buf='',quote=false, statements=[];
for(let i=0;i<schema.length;i++) {
 const ch=schema[i];
 if(ch==="'" && schema[i+1]==="'" && quote){buf+="''";i++;continue;}
 if(ch==="'") quote=!quote;
 if(ch===';'&&!quote){ if(buf.trim())statements.push(buf.trim());buf=''; } else buf+=ch;
}
if(buf.trim())statements.push(buf.trim());
for(const statement of statements){await sql.query(statement);}
console.log(`Applied ${statements.length} database statements.`);
