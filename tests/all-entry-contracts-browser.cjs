const assert=require('node:assert/strict'),path=require('node:path'),P=require('../src/presets.js'),G=require('../src/guide.js'),C=require('../src/core.js'),D=require('../src/decimal.js'),M=require('../src/polynomial.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#growth-window').selectOption('0');await page.locator('#decimal-places').fill('2');await page.locator('#decimal-places').dispatchEvent('change');
  const seen=new Set(),audited=P.examples.filter(e=>{if(width===1280)return true;if(seen.has(e.category))return false;seen.add(e.category);return true;});
  await page.locator('#mode-guide').click();
  for(const example of audited){
    const doc=G.lesson(example,2),names=G.libraryNames(doc);await page.locator('#guide-example').selectOption(String(P.examples.indexOf(example)));
    assert.equal(await page.locator('#guide-inputs tbody tr').count(),doc.inputs?.length??0,example.name);
    if(!names.length){assert.ok(await page.locator('#guide-add-library').isDisabled());continue;}
    await page.locator('#guide-add-library').click();
    const entries=await page.evaluate(()=>LambdaSnapshot.decodeStartingState(localStorage.getItem('lambda-lab-v2')).functions.map(fn=>({name:fn.name,free:[...LambdaCore.freeVars(fn.term)]})));
    assert.deepEqual(entries,[{name:names[0],free:[]}],example.name+' imports exactly the entry');
    await page.locator('#guide-back').click();await page.getByRole('button',{name:`删除函数 ${names[0]}`,exact:true}).click();await page.locator('#mode-guide').click();
  }
  await page.locator('#guide-back').click();
  for(const prefix of ['丘奇列表 · 尾部','丘奇列表 · 映射','二项式系数和','阶乘 · Y','斐波那契','多项式','符号求导','生成导函数','生成原函数','定积分','倒数','序对除法','一拍延迟','λ解释器']){
    const example=P.examples.find(e=>e.name.startsWith(prefix)),doc=G.lesson(example,2),name=G.libraryNames(doc)[0];console.log(`CHECK ${width}px ${example.name}`);
    await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.indexOf(example)));await page.locator('#guide-add-library').click();await page.locator('#guide-back').click();assert.equal(await page.locator('.function-item').count(),1);
    await page.locator('#number-encoding').selectOption('church');await page.locator('#expression').fill(doc.compact);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden(),example.name);
    assert.equal(await page.locator('#unfold-functions').isChecked(),false);let result;
    if(example.expectedType==='decimal'){
      await page.locator('#decimal-value').click();await page.waitForFunction(()=>!document.getElementById('normal-form').hidden,null,{timeout:30000});await page.locator('#normal-form > summary').click();await page.waitForFunction(()=>document.getElementById('normal-form-expression').textContent.length>0);result=C.parse(await page.locator('#normal-form-expression').textContent());
    }else{
      await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:30000});result=C.parse(await page.locator('#current-expression').textContent());
    }
    if(example.expectedType==='decimal')assert.equal(D.format(D.read(result)),example.expected,example.name);
    else if(example.expectedType==='rational')assert.equal(M.formatRational(M.readRational(result)),example.expected,example.name);
    else if(example.expectedType==='polynomial')assert.equal(M.formatPolynomial(M.readPolynomial(result)),example.expected,example.name);
    else assert.ok(C.equal(result,C.parse(example.expected)),example.name);
    await page.getByRole('button',{name:`删除函数 ${name}`,exact:true}).click();
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(`PASS all public contracts: ${audited.length} lesson imports, one closed entry, exact input rows and 14 actual calls with no helper library (${width}px)`);await context.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
