/**
 * Extensible RAWI Developer integration catalog.
 * Only Odoo is active and supported. Future adapters must implement connect/test/listModules/
 * diagnose/buildAddon with per-workspace authorization and encrypted secrets before being enabled.
 * Registry metadata contains no external account secrets and authorizes no remote operations itself.
 */
export const developerPlatformCatalog=Object.freeze([
 Object.freeze({
  code:'odoo',name:'Odoo',active:true,
  protocols:['json2','jsonrpc'],versions:['17','18','19','20'],
  capabilities:['connections','read_only_test','module_inventory','module_scaffolding','diagnostic_history','implementation_tracking'],
  api_namespace:'/api/admin/developer/w/:workspace'
 })
]);
export function listDeveloperPlatforms(){return developerPlatformCatalog.map(({code,name,active,protocols,versions,capabilities})=>({code,name,active,protocols:[...protocols],versions:[...versions],capabilities:[...capabilities]}))}
export function requireEnabledDeveloperPlatform(code){const platform=developerPlatformCatalog.find(p=>p.code===code&&p.active);if(!platform)throw new Error('Unsupported or inactive developer platform');return platform}
