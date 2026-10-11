/* Produce native desktop icon from the exact RAWI Developers SVG. */
import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
const svg=readFileSync(new URL('../../public/developers/rawi-dev-mark.svg',import.meta.url));
mkdirSync(new URL('./build/',import.meta.url),{recursive:true});
await sharp(svg).resize(512,512,{fit:'contain',background:'#080808'}).png().toFile(new URL('./build/icon.png',import.meta.url).pathname);
