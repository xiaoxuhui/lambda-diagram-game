const assert=require('node:assert/strict'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#number-encoding').selectOption('church');
    const diagram=await page.locator('#current-expression').textContent();
    for(const [source,arg,answer] of [['λx.x','3',3],['λn.λf.λx.f (n f x)','3',4]]){
      await page.locator('#expression').fill(source);const outputs=new Map();let count;
      for(let round=0;round<16;round++){
        const basis=round%2?'bckw':'sk';await page.locator('#compile-'+basis).click();
        await page.waitForFunction(()=>document.activeElement===document.getElementById('expression'));
        const output=await page.locator('#expression').inputValue();
        if(outputs.has(basis))assert.equal(output,outputs.get(basis),basis+' round '+round);
        outputs.set(basis,output);
        if(round===1)count=await page.locator('.function-item').count();
        if(round>1)assert.equal(await page.locator('.function-item').count(),count);
        assert.equal(await page.locator('#current-expression').textContent(),diagram);
        if(round===7){await page.reload();assert.equal(await page.locator('#expression').inputValue(),output);}
      }
      const expression=await page.locator('#expression').inputValue();
      // Verify the emitted expression using actual stored definitions, keeping
      // the user's diagram and history untouched throughout this test.
      assert.equal(await page.evaluate(({expression,arg})=>{
        const state=LambdaSnapshot.decodeStartingState(localStorage.getItem('lambda-lab-v2'));
        const term=LambdaLibrary.expand(LambdaCore.parse('('+expression+') '+arg),state.functions);
        return LambdaCore.churchNumber(LambdaCore.normalize(term,10000).term);
      },{expression,arg}),answer);
    }
    assert.deepEqual(errors,[]);console.log(`PASS stable SK/BCKW switching, library reuse, saved reload and actual results (${width}px)`);
    await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
