import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import buildGuideNames from './build-guide-names.cjs';
const base = fileURLToPath(new URL('../', import.meta.url));
buildGuideNames();
let html = await readFile(base+'index.html', 'utf8');
const css = await readFile(base+'src/style.css', 'utf8');
html = html.replace('<link rel="stylesheet" href="src/style.css">', `<style>\n${css}\n</style>`);
for (const name of ['core','function-reduction','trace','run-guard','lazy-eval','meta-lambda','decimal','data-encoding','palette','diagram','diagram-view','polynomial','sequences','boolean-circuits','list-operations','guide-name-data','guide-names','presets','guide-polynomial','guide-advanced','guide-details','guide-pairs','guide','challenges','library','snapshot','download','default-state','workspace-tools','definitions','viewport','encoding-table','data-encoding-editor','input-format-editor','combinator-compiler','app']) {
  const js = await readFile(base+`src/${name}.js`, 'utf8');
  html = html.replace(`<script src="src/${name}.js"></script>`, `<script>\n${js}\n</script>`);
}
await mkdir(base+'dist', { recursive:true });
await writeFile(base+'dist/lambda-lab.html', html);
console.log(`Built dist/lambda-lab.html (${Buffer.byteLength(html)} bytes), no external dependencies.`);
