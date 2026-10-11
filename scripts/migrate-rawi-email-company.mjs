import {readFileSync} from 'node:fs';
import {neon} from '@neondatabase/serverless';
const url=process.env.MIF_DATABASE_URL||process.env.DATABASE_URL;
if(!url)throw Error('MIF_DATABASE_URL is required');
const sql=neon(url),script=readFileSync(new URL('../sql/rawi-email-company.sql',import.meta.url),'utf8');
for(const statement of script.split(';').map(x=>x.trim()).filter(Boolean))await sql.query(statement);
console.log('RAWI email verification and company schema migrated successfully');
