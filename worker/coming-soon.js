// Future products are not deployable applications. Keep legacy Worker URL closed.
export default {fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})}};
