import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = fileURLToPath(new URL('../', import.meta.url));
let html = await readFile(base+'index.html', 'utf8');
const css = await readFile(base+'src/style.css', 'utf8');
html = html.replace('<link rel="stylesheet" href="src/style.css">', `<style>\n${css}\n</style>`);
for (const name of ['core','diagram','presets','library','snapshot','download','workspace-tools','viewport','app']) {
  const js = await readFile(base+`src/${name}.js`, 'utf8');
  html = html.replace(`<script src="src/${name}.js"></script>`, `<script>\n${js}\n</script>`);
}
await mkdir(base+'dist', { recursive:true });
await writeFile(base+'dist/lambda-lab.html', html);
console.log(`Built dist/lambda-lab.html (${Buffer.byteLength(html)} bytes), no external dependencies.`);
