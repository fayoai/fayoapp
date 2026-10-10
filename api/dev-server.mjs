import { serve } from '@hono/node-server';
import app from './app.js';
import { readFileSync, existsSync } from 'node:fs';
if (existsSync('.dev.vars')) {
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
const port=Number(process.env.PORT || 8788);
serve({port, fetch:(req)=>app.fetch(req,process.env)},()=>console.log(`MIF API http://localhost:${port}`));
