const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const C=require('../src/core.js'),P=require('../src/presets.js'),M=require('../src/meta-lambda.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
 const browser=await pw.chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const base=`http://127.0.0.1:${server.address().port}`,example=P.examples.find(item=>item.metaInterpreter),index=P.examples.indexOf(example);
 const run=async()=>{await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:30000});return C.parse(await page.locator('#current-expression').textContent());};
 try{
  await page.goto(base);await page.locator('#growth-window').selectOption('0');
  assert.equal(await page.locator('#examples optgroup[label="高等数学"]').getByRole('option',{name:/λ解释器/}).count(),1);
  await page.locator('#examples').selectOption(String(index));assert.ok(M.isPipeline(C.parse(await page.locator('#expression').inputValue())));
  let result=await run();assert.ok(C.equal(result,C.parse('λz.y')));assert.equal(M.readTerm(result),null);
  assert.match(await page.locator('#decoded').textContent(),/^解释器结果：λ/);
  const steps=await page.locator('#step-count').textContent();await page.locator('#save-state').click();await page.reload();
  await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');assert.equal(await page.locator('#step-count').textContent(),steps);
  assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λz.y')));
  await page.locator('#back').click();assert.ok(await page.locator('#interpreted-result').isHidden());await page.locator('#step').click();
  await page.locator('summary').filter({hasText:'用 λ 解释 λ'}).click();await page.locator('#edit-meta-source').click();assert.ok(C.equal(C.parse(await page.locator('#expression').inputValue()),C.parse(example.metaInput)));
  await page.locator('#expression').fill('(λx.λy.x) _值');await page.locator('#convert').click();await page.locator('#compile-meta-lambda').click();await page.locator('#convert').click();
  result=await run();assert.ok(C.equal(result,C.parse('λz._值')));
  const legacy=fs.readFileSync(path.join(__dirname,'fixtures/meta-lambda-before-linear.txt'),'utf8');await page.locator('#expression').fill(legacy);await page.locator('#convert').click();
  assert.ok(M.isPipeline(C.parse(await page.locator('#expression').inputValue())));result=await run();assert.equal(C.churchNumber(result),3);
  await page.goto(base+'/dist/lambda-lab.html');await page.locator('#mode-free').click();await page.locator('#examples').selectOption(String(index));result=await run();assert.ok(C.equal(result,C.parse('λz.y')));
  assert.deepEqual(errors,[]);console.log('PASS: high-math entry, native Lambda result, free variables, save/reload/back, source editing, legacy upgrade and offline pipeline.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
