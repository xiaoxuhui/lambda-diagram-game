const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('./serve.cjs'),ref=process.argv[2],root=path.resolve(__dirname,'..');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1080}}),rows=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    if(ref)for(const file of ['core','diagram','app']){const body=execFileSync('git',['show',`${ref}:src/${file}.js`],{cwd:root,encoding:'utf8'});await page.route(`**/src/${file}.js`,route=>route.fulfill({contentType:'application/javascript',body}));}
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    for(const size of [300,900,1800]){
      await page.locator('#expression').fill(`g ${size} ((λx.x) y)`);
      const convertMs=await page.evaluate(()=>{const start=performance.now();document.getElementById('convert').click();return performance.now()-start;});
      await page.waitForTimeout(220);
      const row=await page.evaluate(()=>{
        const times={};for(const [name,action] of [['stepMs',()=>document.getElementById('step').click()],['normalAttemptMs',()=>document.getElementById('step').click()],['modeRefreshMs',()=>document.getElementById('mode-free').click()]]){const start=performance.now();action();times[name]=performance.now()-start;}
        times.lines=document.querySelectorAll('#diagram-mount line').length;times.history=document.querySelectorAll('#history-list li').length;return times;
      });rows.push({size,convertMs:Number(convertMs.toFixed(2)),...row});
    }
    console.log(JSON.stringify({revision:ref||'working-tree',browser:browser.version(),rows,errors},null,2));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
