const assert=require('node:assert/strict'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');const P=require('../src/presets.js');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));const browser=await pw.chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS S${++count} ${name}`);};
  const source=async()=>{await page.locator('#expression').fill(P.examples[5].term);await page.locator('#convert').click();};
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await check('custom interval selects custom mode',async()=>{await page.locator('#speed-ms').fill('35');assert.equal(await page.locator('#speed').inputValue(),'custom');});
    await check('custom speed survives save, restore and reload',async()=>{await page.locator('#save-state').click();await page.locator('#speed-ms').fill('50');await page.locator('#restore-state').click();assert.equal(await page.locator('#speed-ms').inputValue(),'35');await page.reload();assert.equal(await page.locator('#speed-ms').inputValue(),'35');});
    await check('invalid speed retains previous valid interval',async()=>{await page.locator('#speed-ms').fill('0');assert.ok(await page.locator('#speed-error').isVisible());await page.locator('#save-state').click();await page.locator('#restore-state').click();assert.equal(await page.locator('#speed-ms').inputValue(),'35');});
    await check('changing speed while running accelerates next timer',async()=>{await source();await page.locator('#speed').selectOption('1200');await page.locator('#run').click();await page.locator('#speed-ms').fill('5');await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:2000});assert.equal(await page.locator('#decoded').textContent(),'Church 数 5');});
    await check('turbo preset runs arithmetic to normal form',async()=>{await source();await page.locator('#speed').selectOption('10');assert.equal(await page.locator('#speed-ms').inputValue(),'10');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:2000});});
    await check('mobile controls do not overflow and no script errors',async()=>{await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('#speed-ms').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);assert.deepEqual(errors,[]);});
    console.log(`Speed browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
