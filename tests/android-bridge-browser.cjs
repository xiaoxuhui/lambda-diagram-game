const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),context=await browser.newContext(),errors=[];let count=0;
  await context.addInitScript(()=>{window.nativeExports=[];window.LambdaAndroid={saveFile(name,content,mime){window.nativeExports.push({name,content,mime});}};});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{await run();console.log(`PASS A${++count} ${name}`);};
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await check('JSON export hands complete current state to native save',async()=>{
      await page.locator('#function-name').fill('IDENTITY');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
      await page.locator('#step').click();await page.locator('#export-state').click();
      const exported=await page.evaluate(()=>nativeExports.at(-1));assert.match(exported.name,/\.json$/);assert.equal(exported.mime,'application/json');
      const saved=JSON.parse(exported.content);assert.equal(saved.functions[0].name,'IDENTITY');assert.equal(saved.session.steps,1);
    });
    await check('SVG export passes full SVG and correct MIME to native save',async()=>{
      await page.locator('#expression').fill('1024');await page.locator('#convert').click();await page.locator('#export-svg').click();
      const exported=await page.evaluate(()=>nativeExports.at(-1));assert.equal(exported.name,'lambda-diagram.svg');assert.equal(exported.mime,'image/svg+xml');
      assert.match(exported.content,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.equal((exported.content.match(/<line /g)||[]).length,4099);
    });
    await check('native JSON export remains importable with functions and history',async()=>{
      const exported=await page.evaluate(()=>nativeExports[0]);
      await page.locator('#import-file').setInputFiles({name:exported.name,mimeType:exported.mime,buffer:Buffer.from(exported.content)});
      await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await page.locator('#step-count').textContent(),'1');assert.equal(await page.locator('#current-expression').textContent(),'λy.y');assert.equal(await page.locator('.function-item').count(),1);
    });
    await check('single-file APK entry has working native bridge offline',async()=>{
      const offline=await context.newPage();offline.on('pageerror',error=>errors.push(error.message));
      await offline.goto(pathToFileURL(path.resolve(__dirname,'../android/app/src/main/assets/lambda-lab.html')).href);
      await offline.locator('#export-state').click();await offline.locator('#export-svg').click();
      assert.deepEqual(await offline.evaluate(()=>nativeExports.map(item=>item.mime)),['application/json','image/svg+xml']);await offline.close();
    });
    await check('native bridge browser checks have no JavaScript errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Android bridge browser checks: ${count} passed, 0 failed.`);
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
