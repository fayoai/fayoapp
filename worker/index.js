import app from '../api/app.js';
import {neon} from '@neondatabase/serverless';
import {runErpSchedule} from '../api/ai-erp.js';
export default {
 fetch(request,env,ctx){return app.fetch(request,env,ctx)},
 async scheduled(_controller,env,ctx){if(!env.DATABASE_URL)return;const run=()=>runErpSchedule(neon(env.DATABASE_URL));ctx.waitUntil(run().catch(err=>console.error('ERP scheduled task error',err.message)))}
};
