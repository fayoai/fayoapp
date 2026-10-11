import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const surfaces={enterprise:'enterprise',mif:'mif'};
export default defineConfig(()=>{
 const surface=surfaces[process.env.VITE_APP_SURFACE]||'';
 return {
  plugins:[
   react(),
   ...(surface?[{name:'rawi-independent-entry',enforce:'pre',transformIndexHtml:{order:'pre',handler(html){
    return html.replace('/src/main.jsx','/src/entry-'+surface+'.jsx');
   }}}]:[])
  ],
  resolve:{alias:surface?[{find:/^\.\/App\.jsx$/,replacement:path.resolve('src/site-shared.jsx')}]:[]},
  server:{port:5173,proxy:{'/api':'http://localhost:8788'}},
  build:{outDir:surface?'dist/'+surface:'dist',sourcemap:false,target:'es2022'}
 }
});
