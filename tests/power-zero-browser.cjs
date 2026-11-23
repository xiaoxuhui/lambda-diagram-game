const assert=require('node:assert/strict'),path=require('node:path'),P=require('../src/presets.js'),G=require('../src/guide.js'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const example=P.examples.find(e=>e.name.startsWith('乘方 ·')),name=G.libraryNames(G.lesson(example))[0];
    await page.locator('#examples').selectOption(String(P.examples.indexOf(example)));await page.locator('#example-add-library').click();assert.equal(await page.locator('.function-item').count(),1);
    for(const unfold of [false,true]){
      await page.locator('#unfold-functions').setChecked(unfold);
      for(const [a,b,expected] of [[0,0,1],[0,3,0],[3,0,1],[2,3,8]]){
        await page.locator('#expression').fill(`${name} ${a}_church ${b}_church`);await page.locator('#convert').click();await page.locator('#fast-run').click();
        await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');assert.equal(C.churchNumber(C.parse(await page.locator('#current-expression').textContent())),expected);
      }
    }
    await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.indexOf(example)));assert.match(await page.locator('#guide-principle').textContent(),/0⁰.*1/);
    assert.deepEqual(errors,[]);console.log(`PASS powers: zero base, zero exponent, 0^0, numeric results, imported entry, both unfold settings and explanation (${width}px)`);await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
