const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),C=require('../src/core.js'),P=require('../src/presets.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs'),pred='λn.λf.λx.n (λg.λh.h (g f)) (λu.x) i';
(async()=>{
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('#function-name').fill('i');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
  const example=P.examples.find(e=>e.metaInterpreter);await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.indexOf(example)));assert.equal(await page.locator('#guide-inputs tbody tr').count(),1);await page.locator('#guide-add-library').click();await page.locator('#guide-back').click();
  const run=async()=>{await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:30000});return C.parse(await page.locator('#current-expression').textContent());};
  const input=`interpret (${pred})`;await page.locator('#expression').fill(input);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());assert.equal(await page.locator('#expression').inputValue(),input);assert.equal(await page.locator('#step-count').textContent(),'0');
  const expected=C.substitute(C.parse(pred),'i',C.parse('λx.x'));assert.ok(C.equal(await run(),expected));assert.match(await page.locator('#decoded').textContent(),/^解释器结果/);
  await page.locator('#save-state').click();assert.match(await page.locator('#storage-status').textContent(),/已自动保存/,await page.locator('#save-feedback').textContent());await page.reload();await page.waitForFunction(value=>document.getElementById('expression').value===value,input);assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),expected));await page.locator('#back').click();await page.locator('#step').click();
  await page.locator('#expression').fill(`interpret ((${pred}) 3_church)`);await page.locator('#convert').click();assert.equal(C.churchNumber(await run()),2);
  await page.locator('#expression').fill(`(λvalue.value) (interpret ((${pred}) 3_church))`);await page.locator('#convert').click();assert.equal(C.churchNumber(await run()),2,'nested call uses the same prepared input contract');
  await page.locator('#function-name').fill('decodedpred');await page.locator('#function-source').fill(input);await page.locator('#function-add').click();await page.waitForFunction(()=>document.querySelector('.function-item[data-name="decodedpred"]'));
  await page.locator('#expression').fill('decodedpred 3_church');await page.locator('#convert').click();assert.equal(C.churchNumber(await run()),2,'saving an interpreted expression prepares the input too');
  await page.getByRole('button',{name:'删除函数 interpret',exact:true}).click();await page.locator('#function-name').fill('interpret');await page.locator('#function-source').fill(fs.readFileSync(path.join(__dirname,'fixtures/interpret-two-arg.txt'),'utf8'));await page.locator('#function-add').click();
  await page.locator('#expression').fill(input);await page.locator('#convert').click();assert.ok(C.equal(await run(),expected),'old saved interpreter also accepts the ordinary expression');
  assert.deepEqual(errors,[]);console.log(`PASS reported interpret call: one argument, nested call, saved function, exact predecessor, pred 3 = 2, original source, archive/replay and old definitions (${width}px)`);await context.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
