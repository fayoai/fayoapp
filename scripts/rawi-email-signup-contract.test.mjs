import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Unverified signup must not create a session or workspace',()=>{
 const api=read('api/app.js');
 const signUp=api.slice(api.indexOf("app.post('/api/admin/register'"),api.indexOf("app.post('/api/admin/verify-email'"));
 assert.match(signUp,/deliverVerificationCode/);
 assert.match(signUp,/rawi_pending_signups/);
 assert.doesNotMatch(signUp,/setCookie|INSERT INTO admins|createNeonTenantDatabase/);
 assert.match(api,/company_setup_required:true/);
 assert.match(api,/Complete your company profile first/);
});
test('Company fields and inline send button are present in the responsive onboarding',()=>{
 const ui=read('src/MifSmartShell.jsx');
 for(const part of ['verificationCode','confirmEmail','resendCode','signupStep','submitCompany','selectCompanyLogo'])assert.ok(ui.includes(part));
 for(const field of ['logo_data','name','address','commercial_registration','tax_number','phone','mobile','website','emails','activity','description'])assert.ok(ui.includes('company.'+field),field);
 const form=ui.slice(ui.indexOf('<form className="mif-composer"'),ui.indexOf('</form>',ui.indexOf('<form className="mif-composer"')));
 assert.ok(form.indexOf('rawi-composer-toolbar')>=0);
 assert.ok(form.indexOf('rawi-composer-toolbar')<form.indexOf('className="rawi-send"'));
});

test('Signup is independent of optional encrypted AI connector credentials',()=>{
 const api=read('api/app.js'),providers=read('api/ai-router.js');
 const readiness=api.slice(api.indexOf('function signupReady(settings){'),api.indexOf("app.get('/api/public/rawi/status'"));
 assert.ok(readiness.includes('mailReady(settings)'));
 assert.ok(readiness.includes('neonTenantConfig(settings)'));
 assert.doesNotMatch(readiness,/CONNECTOR_ENCRYPTION_KEY/);
 assert.match(providers,/unsealProviderSecret\(p\.encrypted_key,env\)/);
});

test('Email signup reports stable worker hashing revision without exposing private diagnostic traces',()=>{
 const app=read('api/app.js'),flow=read('.github/workflows/deploy.yml');
 assert.match(app,/password_kdf_iterations:PASSWORD_HASH_ITERATIONS/);
 assert.doesNotMatch(app,/X-Rawi-Probe|internal-diag/);
 assert.match(flow,/status\.password_kdf_iterations===100000/);
 assert.doesNotMatch(flow,/Diagnose registration backend with disposable invalid-domain address/);
 assert.match(flow,/group: mif-smart-platform-production-deploy/);
});
