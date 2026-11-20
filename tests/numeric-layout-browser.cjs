const assert=require('node:assert/strict'),path=require('node:path');
const C=require('../src/core.js'),P=require('../src/presets.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
const arity=term=>{let node=term.body,n=0;while(node.type==='app'){n++;node=node.fn;}return n;};
(async()=>{
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
 const browser=await pw.chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#growth-window').selectOption('0');
  const input=async(source,encoding)=>{await page.locator('#number-encoding').selectOption(encoding);await page.locator('#expression').fill(source);await page.locator('#convert').click();};
  await input('-3','int');assert.equal(arity(C.parse(await page.locator('#current-expression').textContent())),2);assert.equal(await page.locator('#decoded').textContent(),'丘奇整数 -3');
  await input('-1.25','decimal');assert.equal(arity(C.parse(await page.locator('#current-expression').textContent())),3);assert.equal(await page.locator('#decoded').textContent(),'小数 -1.25');
  await input('0.125','decimal');const expected=C.parse('λk.k (λa b.a) [0,1,2,5] 3');
  assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),expected));assert.equal(await page.locator('#decoded').textContent(),'小数 0.125');
  await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'小数 0.125');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).view.decimalDigitsOrder),'forward');
  const old=C.parse('λk.k (λa b.a) [5,2,1] 3');
  const legacy=await page.evaluate(term=>{const s=JSON.parse(localStorage.getItem('lambda-lab-v2'));s.draft='legacy 0.125';s.session={original:term,steps:0,dirty:false,halt:'',encodings:['decimal']};s.selection={start:0,end:0};delete s.view.decimalDigitsOrder;return JSON.stringify(s);},old);
  await page.locator('#import-file').setInputFiles({name:'legacy-decimal.json',mimeType:'application/json',buffer:Buffer.from(legacy)});
  await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
  assert.equal(await page.locator('#decoded').textContent(),'小数 0.125');assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),old));
  await page.reload();assert.equal(await page.locator('#decoded').textContent(),'小数 0.125');assert.match(await page.locator('#expression-encoding').textContent(),/旧数位顺序/);
  await input('0.125','decimal');assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),expected));
  await input('[1,2,5]','list');assert.equal(await page.locator('#decoded').textContent(),'丘奇列表 [1, 2, 5]');
  await input('λk.k 0_church 3_church','church');assert.equal(await page.locator('#decoded').textContent(),'有理数 0');
  const index=P.examples.findIndex(e=>e.decimalOperation==='SQRT');await page.locator('#decimal-places').fill('2');await page.locator('#examples').selectOption(String(index));
  assert.ok((await page.locator('#expression').inputValue()).includes('(2_church)'));assert.match(await page.locator('#example-info').textContent(),/输出小数位数 2_church/);
  await page.locator('#decimal-value').click();await page.waitForFunction(()=>document.getElementById('decimal-value-result').textContent==='小数 1.41',null,{timeout:30000});
  const source=await page.locator('#expression').inputValue();await input(source.replace('(2_church)','(6_church)'),'decimal');
  await page.locator('#decimal-value').click();await page.waitForFunction(()=>document.getElementById('decimal-value-result').textContent==='小数 1.414213',null,{timeout:30000});
  await page.locator('#save-state').click();await page.reload();await page.waitForFunction(()=>document.getElementById('expression').value.includes('(6_church)'));
  await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.name.startsWith('斐波那契'))));assert.match(await page.locator('#guide-core').textContent(),/^fib = y \(λr/);
  assert.deepEqual(errors,[]);console.log('PASS: untagged integer/decimal fields, rational ambiguity, editable output precision, save/reload, and named Fibonacci.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
