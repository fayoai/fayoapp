import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const url=process.env.DATABASE_URL;
if(!url) throw new Error('DATABASE_URL is required.');
const sql=neon(url);
const schema=readFileSync(new URL('../sql/schema.sql',import.meta.url),'utf8');
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
