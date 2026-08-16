#!/usr/bin/env node
/**
 * Build a publishable copy of the pasty finder.
 *
 * The app bundles pasty photographs as inline data URIs. Those are unverified test
 * assets and are NOT cleared for redistribution, so they must not go onto a public
 * URL. This strips them out; the drawn SVG artwork underneath takes over on its own,
 * which is exactly what that layer exists for.
 *
 *   node make-public.mjs            -> writes public/index.html
 *   node make-public.mjs out/app.html
 *
 * The result is a single self-contained file safe to host anywhere static. Host it
 * over https and the "Use my location" button works on a phone.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'index.html');
const dest = resolve(here, process.argv[2] ?? 'public/index.html');

const html = await readFile(src, 'utf8');

// Match the whole PHOTOS object literal, however many keys it has.
const re = /var PHOTOS = \{[\s\S]*?\n\};/;
if (!re.test(html)) {
  console.error('Could not find the PHOTOS block in index.html — has it been renamed?');
  process.exit(1);
}

const before = html.match(re)[0].length;
const stripped = html.replace(
  re,
  'var PHOTOS = {};   // stripped for publication — the drawn artwork layer takes over'
);

// mediaHTML() and the hero both read PHOTOS.* and would otherwise set src="undefined",
// which paints a broken-image glyph over the artwork. Guard both call sites.
let out = stripped
  .replace(
    "h += '<img class=\"photo in\" alt=\"\" aria-hidden=\"true\" src=\"' + lib + '\" onerror=\"this.remove()\">';",
    "if(lib) h += '<img class=\"photo in\" alt=\"\" aria-hidden=\"true\" src=\"' + lib + '\" onerror=\"this.remove()\">';"
  )
  .replace(
    /applyHeroPhoto\(\{src: PHOTOS\.hero,/,
    'if(PHOTOS.hero) applyHeroPhoto({src: PHOTOS.hero,'
  )
  .replace(
    /title: 'bundled library photograph'\}\);/,
    "title: 'bundled library photograph'});"
  )
  // captions must stop claiming a library photo that is no longer there
  .replace(/: 'Library photo'\) \+ '<\/span><\/div><\/div>';/, ": 'Drawn artwork') + '</span></div></div>';");

if (out === stripped) {
  console.warn('Warning: guard rewrites did not all apply — check the output before hosting.');
}

await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, out, 'utf8');

const kb = n => Math.round(n / 1024) + ' KB';
console.log(`Stripped ${kb(before)} of embedded photography.`);
console.log(`${kb(html.length)} -> ${kb(out.length)}`);
console.log(`Wrote ${dest}`);
console.log('\nSafe to host publicly. Serve it over https so GPS works on a phone.');
