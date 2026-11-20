const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const P=require('../src/presets.js'),G=require('../src/guide.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];
  const base=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',error=>errors.push(error.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS G${++count} ${name}`);};
  try{
    await page.goto(base);
    await check('the explanation mode follows challenges and covers every example with its exact source',async()=>{
      assert.equal(await page.locator('#mode-challenge + #mode-guide').count(),1);
      const original=await page.locator('#expression').inputValue();
      await page.locator('#mode-guide').click();assert.ok(await page.locator('#guide-panel').isVisible());
      assert.ok(await page.locator('#lab-screen').isHidden());assert.ok(await page.locator('.save-bar').isHidden());
      assert.equal(await page.locator('#guide-example option').count(),P.examples.length);
      for(const [index,example] of P.examples.entries()){
        const doc=G.lesson(example);assert.ok(doc.principle.length>=2);
        await page.locator('#guide-example').selectOption(String(index));
        assert.equal(await page.locator('#guide-title').textContent(),G.titleFor(example));
        assert.equal(await page.locator('#guide-core').textContent(),doc.core);
        assert.equal(await page.locator('#guide-principle p').count(),doc.principle.length);
        assert.equal(await page.locator('#guide-expression').textContent(),P.inputSourceFor(example,6));
        if(doc.inputs){assert.equal(await page.locator('#guide-inputs tbody tr').count(),doc.inputs.length);assert.equal(await page.locator('#guide-steps li').count(),doc.steps.length);}
      }
      assert.equal(await page.locator('#expression').inputValue(),original);
      assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('example explanations use shorthand and expand the complete program only on demand',async()=>{
      const index=P.examples.findIndex(example=>example.name.startsWith('阶乘 · 迭代'));
      await page.locator('#guide-example').selectOption(String(index));
      assert.equal(await page.locator('#guide-expression-short').textContent(),'fac 3');
      assert.ok(await page.locator('#guide-expression').isHidden());
      assert.deepEqual(await page.locator('.guide-pair-compact').allTextContents(),G.lesson(P.examples[index]).pairExamples.map(item=>item.compactSource));
      assert.ok(await page.locator('.guide-pair-source').first().isHidden());
      await page.locator('#guide-complete-expression > summary').click();assert.ok(await page.locator('#guide-expression').isVisible());
      assert.equal(await page.locator('#guide-expression').textContent(),P.inputSourceFor(P.examples[index]));
      await page.locator('.guide-pair-complete > summary').first().click();assert.ok(await page.locator('.guide-pair-source').first().isVisible());
      await page.locator('#guide-example').selectOption('0');assert.ok(await page.locator('#guide-expression').isHidden());
    });
    await check('s, c and w are visible shorthand calls and are actually called by the runnable examples',async()=>{
      const C=require('../src/core.js');
      for(const [index,short,expected] of [[4,'s true true','λx.x'],[9,'c true 2 3','3'],[10,'w mul 3','9']]){
        await page.locator('#guide-example').selectOption(String(index));
        assert.equal(await page.locator('#guide-expression-short').textContent(),short);
        await page.locator('#guide-load').click();
        assert.match(await page.locator('#expression').inputValue(),new RegExp('λ'+short[0]+'\\b'));
        await page.locator('#convert').click();await page.locator('#fast-run').click();
        await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
        assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(expected)));
        await page.locator('#mode-guide').click();
      }
    });
    await check('search, category filtering, empty results and previous/next navigation work',async()=>{
      await page.locator('#guide-category').selectOption('基础数学');
      assert.equal(await page.locator('#guide-example option').count(),P.examples.filter(e=>e.category==='基础数学').length);
      await page.locator('#guide-next').click();assert.ok(await page.locator('#guide-previous').isEnabled());
      await page.locator('#guide-previous').click();assert.ok(await page.locator('#guide-previous').isDisabled());
      await page.locator('#guide-search').fill('前驱');
      assert.ok((await page.locator('#guide-example option').allTextContents()).some(name=>name.startsWith('前驱')));
      await page.locator('#guide-search').fill('no-such-example');assert.ok(await page.locator('#guide-load').isDisabled());assert.ok(await page.locator('#guide-article').isHidden());
      await page.locator('#guide-search').fill('');await page.locator('#guide-category').selectOption('');
    });
    await check('the selected explanation survives save and reload, and loads the displayed decimal program',async()=>{
      const index=P.examples.findIndex(e=>e.decimalOperation==='DIV');
      await page.locator('#guide-example').selectOption(String(index));
      await page.waitForFunction(name=>JSON.parse(localStorage.getItem('lambda-lab-v2')||'{}').view?.guideExample===name,P.examples[index].name);await page.reload();
      await page.waitForFunction(()=>document.getElementById('mode-guide').getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('#guide-title').textContent(),G.titleFor(P.examples[index]));
      const expression=await page.locator('#guide-expression').textContent();
      await page.locator('#guide-load').click();
      assert.equal(await page.locator('#mode-free').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#number-encoding').inputValue(),'decimal');
      assert.equal(await page.locator('#expression').inputValue(),expression);
      assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('long expressions and the third mode fit on mobile',async()=>{
      await page.setViewportSize({width:390,height:844});await page.locator('#mode-guide').click();
      await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.decimalOperation==='SIN')));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok((await page.locator('#guide-expression').textContent()).length>1000);
      fs.mkdirSync(path.resolve(__dirname,'artifacts'),{recursive:true});
      await page.locator('#guide-input-section').screenshot({path:path.resolve(__dirname,'artifacts/guide-input-mobile.png')});
      await page.locator('#guide-steps-section').screenshot({path:path.resolve(__dirname,'artifacts/guide-series-mobile.png')});
    });
    await check('advanced lessons show actual derivations and expandable runtime helper definitions',async()=>{
      const derivative=P.examples.findIndex(e=>e.name.startsWith('符号求导'));
      await page.locator('#guide-example').selectOption(String(derivative));
      assert.match(await page.locator('#guide-steps').textContent(),/\[2\/1,3\/1\]/);
      assert.match(await page.locator('#guide-inputs').textContent(),/接收丘奇数/);
      await page.locator('#guide-all-symbols > summary').click();
      const encoderName=G.lesson(P.examples[derivative]).symbols.find(symbol=>symbol.uses.includes('encodepoly')).name;
      const encoder=page.locator('#guide-symbols details').filter({has:page.locator('summary',{hasText:new RegExp('^'+encoderName+'：')})}).last();
      await encoder.locator('summary').click();assert.match(await encoder.locator('code').textContent(),new RegExp('^'+encoderName+' = λ'));
      await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.decimalOperation==='POW')));
      assert.match(await page.locator('#guide-inputs').textContent(),/3_church/);
      await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.decimalOperation==='TAN')));
      assert.match(await page.locator('#guide-steps').textContent(),/tₖ₊₁/);
      assert.match(await page.locator('#guide-boundaries').textContent(),/requested/);
    });
    await check('polynomial lessons explain each data shape and render verified state tables on mobile',async()=>{
      for(const prefix of ['多项式','符号求导','生成导函数','生成原函数','定积分']){
        const index=P.examples.findIndex(e=>e.name.startsWith(prefix)),doc=G.lesson(P.examples[index]);
        await page.locator('#guide-example').selectOption(String(index));
        assert.ok(await page.locator('#guide-flow-section').isVisible());
        assert.equal(await page.locator('#guide-overview').textContent(),doc.overview);
        assert.equal(await page.locator('#guide-flow tbody tr').count(),doc.flow.rows.length);
        assert.equal(await page.locator('#guide-steps table').count(),doc.steps.filter(step=>step[3]).length);
        assert.equal(await page.locator('#guide-expression').textContent(),P.inputSourceFor(P.examples[index]));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
      assert.match(await page.locator('#guide-overview').textContent(),/被积函数/);
      assert.match(await page.locator('#guide-steps').textContent(),/F\(3\)−F\(0\)/);
      await page.locator('#guide-flow-section').screenshot({path:path.resolve(__dirname,'artifacts/polynomial-flow-mobile.png')});
      const derivative=P.examples.findIndex(e=>e.name.startsWith('符号求导'));
      await page.locator('#guide-example').selectOption(String(derivative));
      const state=page.locator('#guide-steps > li').filter({has:page.locator('h4',{hasText:'状态里的次数从哪里来'})});
      assert.match(await state.textContent(),/\(3,\[2\/1,3\/1\]\)/);
      await state.screenshot({path:path.resolve(__dirname,'artifacts/polynomial-state-mobile.png')});
      await page.locator('#guide-example').selectOption('0');assert.ok(await page.locator('#guide-flow-section').isHidden());
    });
    await check('pair lessons show results without per-example load buttons and the original program supports stepping and undo',async()=>{
      await page.locator('#guide-example').selectOption(String(P.examples.findIndex(example=>example.name.startsWith('阶乘 · 迭代'))));
      const definitions=await page.locator('#guide-core').textContent();
      assert.equal(definitions.split('\n').length,7);
      assert.match(definitions,/^fac = λn\.n facstep \(pair 0 1\) false$/m);
      assert.equal(await page.locator('#guide-principle p').count(),2);
      assert.equal(await page.locator('#guide-steps li').count(),5);
      assert.equal(await page.locator('#guide-core-section h3').textContent(),'本篇函数定义与辅助函数');
      for(const [index,example] of P.examples.entries()){
        const doc=G.lesson(example);if(!doc.pairExamples)continue;
        await page.locator('#guide-example').selectOption(String(index));
        assert.ok(await page.locator('#guide-pair-section').isVisible());
        assert.equal(await page.locator('.guide-pair-expression').count(),doc.pairExamples.length);
        assert.deepEqual(await page.locator('.guide-pair-source').allTextContents(),doc.pairExamples.map(item=>item.source));
        assert.deepEqual(await page.locator('.guide-pair-result code').allTextContents(),doc.pairExamples.map(item=>item.expected));
        assert.ok(await page.evaluate(()=>document.getElementById('guide-source-section').compareDocumentPosition(document.getElementById('guide-core-section'))&Node.DOCUMENT_POSITION_FOLLOWING));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
      const index=P.examples.findIndex(example=>example.name.startsWith('有序对'));
      await page.locator('#guide-example').selectOption(String(index));
      assert.equal(await page.locator('.guide-pair-expression button').count(),0);
      await page.locator('#guide-load').click();
      assert.equal(await page.locator('#expression').inputValue(),P.inputSourceFor(P.examples[index]));
      assert.equal(await page.locator('#mode-free').getAttribute('aria-pressed'),'true');
      await page.locator('#step').click();assert.equal(await page.locator('#step-count').textContent(),'1');
      await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'0');
      await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
      const C=require('../src/core.js');assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(P.examples[index].expected)));
      await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(index));
      await page.locator('#guide-pair-section').screenshot({path:path.resolve(__dirname,'artifacts/pair-expressions-mobile.png')});
      await page.locator('#guide-example').selectOption('0');assert.ok(await page.locator('#guide-pair-section').isHidden());
    });
    await check('offline bundle contains the complete explanation catalog',async()=>{
      const offline=await context.newPage();await offline.goto(base+'/dist/lambda-lab.html');
      await offline.locator('#mode-guide').click();
      assert.equal(await offline.locator('#guide-example option').count(),P.examples.length);
      await offline.locator('#guide-example').selectOption('13');
      assert.match(await offline.locator('#guide-principle').textContent(),/第一次/);
      await offline.locator('#guide-example').selectOption(String(P.examples.findIndex(example=>example.name.startsWith('阶乘 · 迭代'))));
      assert.equal(await offline.locator('.guide-pair-expression').count(),3);await offline.close();
    });
    await check('there are no page errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Explanation browser checks: ${count} passed.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
