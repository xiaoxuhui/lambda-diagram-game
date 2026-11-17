const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
const Y='λf.(λx.f (x x)) (λx.f (x x))';
const ZERO='λn.n (λx.λt f.f) (λt f.t)';
const PRED='λn f x.n (λg h.h (g f)) (λu.x) (λu.u)';
const MULT='λm n f.m (n f)';
const factorial=`(${Y}) (λr n.(${ZERO}) n 1 ((${MULT}) n (r ((${PRED}) n)))) 3`;
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const browser=await pw.chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS U${++passed} ${name}`);};
  const source=async(s)=>{await page.locator('#number-encoding').selectOption('church');await page.locator('#expression').fill(s);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());};
  const run=async(answer)=>{await page.locator('#speed-ms').fill('1');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:180000});assert.equal(await page.locator('#decoded').textContent(),`Church 数 ${answer}`);};
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await check('3! completes all 646 steps, keeps every history frame and reloads',async()=>{
      await source(factorial);await run(6);assert.equal(await page.locator('#step-count').textContent(),'646');
      assert.equal(await page.locator('#history-count').textContent(),'646 次替换');
      await page.locator('#save-state').click();await page.reload();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='646');assert.equal(await page.locator('#decoded').textContent(),'Church 数 6');
      await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'645');await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'Church 数 6');
    });
    await check('2^10 completes all 2048 steps, renders every one of 4099 lines',async()=>{
      await source('(λb e.e b) 2 10');await run(1024);
      assert.equal(await page.locator('#step-count').textContent(),'2048');assert.equal(await page.locator('#history-count').textContent(),'2048 次替换');
      assert.equal(await page.locator('#diagram-mount line').count(),4099);
      assert.equal(await page.locator('#diagram-mount [data-kind="variable"]').count(),1025);
      await page.locator('#actual-size').click();
      await page.waitForFunction(()=>document.getElementById('zoom-label').textContent==='100%');
      fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.diagram-card').screenshot({path:path.join(__dirname,'artifacts','unlimited-power.png')});
      await page.locator('#save-state').click();await page.reload();await page.waitForFunction(()=>document.getElementById('decoded').textContent==='Church 数 1024');assert.equal(await page.locator('#step-count').textContent(),'2048');
      for(let i=2047;i>=2044;i--){await page.locator('#back').click();await page.waitForFunction(i=>Number(document.getElementById('step-count').textContent)===i,i);}
      assert.ok(await page.locator('#history-list li').count()<=32);
      await page.locator('#history-details summary').click();
      await page.locator('#history-jump').fill('42');await page.locator('#history-jump').press('Tab');
      const row=page.locator('#history-list li').filter({has:page.getByText('42',{exact:true})});
      await row.getByRole('button',{name:'查看此步'}).click();await row.locator('code').waitFor();
    });
    await check('locally repeated contraction stops even in a large diagram',async()=>{
      await source('g 2200 ((λx.x x) (λx.x x))');await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.getElementById('run-status').textContent.includes('重复归约循环'));
      assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('a large legacy replay can be canceled without replacing its autosave',async()=>{
      const isolated=await browser.newContext(),p=await isolated.newPage();
      try{
        const draft='(λx.x x) (λx.x x)',steps=10000000;
        const snapshot={version:2,draft,functions:[],completed:[],mode:'free',level:0,
          session:{original:C.parse(draft),steps,dirty:false,halt:''},
          view:{speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},
          selection:{start:0,end:0},error:''};
        await p.addInitScript(snapshot=>localStorage.setItem('lambda-lab-v2',JSON.stringify(snapshot)),snapshot);
        await p.goto(`http://127.0.0.1:${server.address().port}/`);
        await p.locator('#cancel-restore').click();
        await p.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('已取消重放'));
        assert.equal(await p.locator('#expression').inputValue(),draft);
        assert.equal(await p.locator('#step-count').textContent(),'0');
        assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).session.steps),steps);
        await p.goto(`http://127.0.0.1:${server.address().port}/?recover=1`);
        await p.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('已打开草稿'));
        assert.equal(await p.locator('#expression').inputValue(),draft);
        assert.equal(await p.locator('#diagram-mount svg').count(),0);
        assert.equal(await p.locator('#restore-progress').isVisible(),false);
        assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).session.steps),steps);
      }finally{await isolated.close();}
    });
    await check('browser JavaScript stays error free',async()=>assert.deepEqual(errors,[]));
    console.log(`Unlimited browser checks: ${passed} passed, 0 failed.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
