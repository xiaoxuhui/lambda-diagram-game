const assert=require('node:assert/strict'),path=require('node:path'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const hall=process.env.LAMBDA_HALL_HTML_PATH;
const server=hall?require('node:http').createServer((req,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(require('node:fs').readFileSync(hall))).listen(0,'127.0.0.1'):require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const browser=await pw.chromium.launch(),errors=[];let passed=0;
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.locator('#number-encoding').selectOption('church');
      await page.locator('#expression').fill('(λn.(λm n f.m (n f)) n n) 3');
      const originalDiagram=await page.locator('#current-expression').textContent();
      await page.locator('#compile-combinators').click();
      await page.waitForFunction(()=>document.getElementById('combinator-status').textContent.includes('已在外部编译'));
      assert.match(await page.locator('#expression').inputValue(),/^w mul /);
      assert.equal(await page.locator('#current-expression').textContent(),originalDiagram,'compilation does not run or convert the diagram');
      assert.equal(await page.locator('#step-count').textContent(),'0');
      assert.equal(await page.locator('.function-item[data-name="w"]').count(),1);
      assert.equal(await page.locator('.function-item[data-name="mul"]').count(),1);
      await page.locator('#save-state').click();await page.reload();if(hall)await page.locator('#restore-state').click();
      assert.match(await page.locator('#expression').inputValue(),/^w mul /);
      await page.locator('#convert').click();await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
      assert.equal(C.churchNumber(C.parse(await page.locator('#current-expression').textContent())),9);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      console.log('PASS',++passed,width+'px: external compile, external library, save/reload and real reduction');
      await context.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
