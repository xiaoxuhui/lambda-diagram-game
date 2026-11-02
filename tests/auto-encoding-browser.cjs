const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),C=require('../src/core.js'),E=require('../src/data-encoding.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS N${++passed} ${name}`);};
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:950},hasTouch:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
      const define=async(name,source)=>{
        if(!await page.locator('#encoding-name').isVisible())await page.locator('#custom-data-panel > summary').click();
        await page.locator('#encoding-new').click();await page.locator('#encoding-name').fill(name);await page.locator('#encoding-source').fill(source);await page.locator('#encoding-save').click();assert.ok(await page.locator('#encoding-error').isHidden());
      };
      const typed=async(source,label)=>{await page.locator('#expression').fill(source);await page.waitForFunction(label=>document.getElementById('decoded').textContent===label,label);};
      await check(`${width}px entering zero automatically encodes and reduces without clicking any run or convert button`,async()=>{
        await define('Box','λn.λk.k n');await typed('0','0_Box');
        assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');assert.equal(await page.locator('#step-count').textContent(),'0');
        assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λk.k 0')));
        assert.equal(await page.locator('#encoding-table-body tr').count(),1);assert.equal(await page.locator('#encoding-table').evaluate(panel=>panel.open),false);
        assert.ok((await page.locator('#encoding-table').boundingBox()).height<60);
      });
      await check(`${width}px only numeral conversion is automatic and the surrounding calculation still steps normally`,async()=>{
        await page.locator('#expression').fill('(λx.x) 3_Box');await page.locator('#convert').click();
        await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='可以归约');
        const term=C.parse(await page.locator('#current-expression').textContent());assert.ok(C.findRedex(term));assert.equal(C.findRedex(term.arg),null);assert.ok(C.equal(term.arg,C.parse('λk.k 3')));
        await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'3_Box');assert.equal(await page.locator('#step-count').textContent(),'1');
      });
      await check(`${width}px explicit names override the menu and typing decimals is also automatic`,async()=>{
        await typed('0_丘奇数','FALSE / Church 数 0');await page.locator('#number-encoding').selectOption('decimal');await typed('-0.5','小数 -0.5');
        await typed('0_Box','0_Box');await page.locator('#number-encoding').selectOption('custom:Box');
      });
      await check(`${width}px saved function literals are already encoded and retain their original editable source`,async()=>{
        await page.locator('#function-name').fill('ZEROBOX');await page.locator('#function-source').fill('0_Box');await page.locator('#function-add').click();
        await page.waitForFunction(()=>document.getElementById('function-count').textContent==='1 个函数');
        await page.locator('#expression').fill('ZEROBOX');await page.locator('#convert').click();await page.waitForFunction(()=>document.getElementById('decoded').textContent==='0_Box');
        assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');
        await page.getByRole('button',{name:'编辑函数 ZEROBOX',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'0_Box');await page.locator('#function-cancel').click();
      });
      await check(`${width}px table entry typing is automatic and many complete rows remain inside a scroll area`,async()=>{
        await page.locator('#encoding-table-title').click();await page.locator('#encoding-table-number').fill('1');
        await page.waitForFunction(()=>!!document.querySelector('#encoding-table-body tr[data-number="1"]'));
        for(const number of [2,4,5,6,7]){
          await page.locator('#encoding-table-number').fill(String(number));await page.locator('#encoding-table-generate').click();
          await page.waitForFunction(number=>!!document.querySelector(`#encoding-table-body tr[data-number="${number}"]`),number);
        }
        assert.equal(await page.locator('#encoding-table-body tr').count(),8);
        const scroll=await page.locator('.encoding-table-scroll').evaluate(el=>({height:el.clientHeight,content:el.scrollHeight}));assert.ok(scroll.height<=220&&scroll.content>scroll.height);
        await page.locator('#encoding-table-title').click();assert.ok((await page.locator('#encoding-table').boundingBox()).height<60);
        await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#encoding-table').evaluate(panel=>panel.open),false);assert.equal(await page.locator('#encoding-table-body tr').count(),8);
        fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.editor-card').screenshot({path:path.join(__dirname,'artifacts',`auto-encoding-${width}.png`)});
      });
      await check(`${width}px endless automatic encoding is cancellable and cannot overwrite a newly typed value`,async()=>{
        await define('Loop','λn.(λx.x x) (λx.x x)');await page.locator('#expression').fill('0');await page.locator('#cancel-encoding').waitFor({state:'visible'});
        await typed('2_church','Church 数 2');assert.equal(await page.locator('#cancel-encoding').isHidden(),true);
        await page.locator('#expression').fill('0_Loop');await page.locator('#cancel-encoding').waitFor({state:'visible'});await page.locator('#cancel-encoding').click();assert.ok(await page.locator('#cancel-encoding').isHidden());
        await typed('3_church','Church 数 3');assert.equal(await page.locator('#expression').inputValue(),'3_church');
      });
      await check(`${width}px function encoding can be canceled before saving and a new definition remains intact`,async()=>{
        await page.locator('#function-name').fill('PENDING');await page.locator('#function-source').fill('0_Loop');await page.locator('#function-add').click();
        await page.waitForFunction(()=>document.getElementById('function-cancel').textContent==='取消编码');await page.locator('#function-cancel').click();
        assert.equal(await page.locator('#function-count').textContent(),'1 个函数');await page.locator('#function-source').fill('0_church');await page.locator('#function-add').click();
        await page.waitForFunction(()=>document.getElementById('function-count').textContent==='2 个函数');assert.ok(await page.locator('#function-error').isHidden());
      });await context.close();
    }
    await check('offline page automatically reduces a custom zero',async()=>{
      const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/dist/lambda-lab.html');
      await page.locator('#custom-data-panel > summary').click();await page.locator('#encoding-name').fill('Own');await page.locator('#encoding-source').fill('λn.λk.k n');await page.locator('#encoding-save').click();
      await page.locator('#expression').fill('0');await page.waitForFunction(()=>document.getElementById('decoded').textContent==='0_Own');assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');await context.close();
    });
    await check('refreshing a saved unfinished numeral automatically finishes its encoding',async()=>{
      const entries=E.define([],'OldBox','λn.λk.k n'),raw={version:2,draft:'0',functions:[],dataEncodings:entries,encodingDraft:{name:'OldBox',source:entries[0].source,editing:'OldBox'},completed:[],mode:'free',level:0,session:{original:E.parse('0',entries,Infinity,'custom:OldBox').term,steps:0,dirty:false,halt:'',encodings:['OldBox']},view:{numberEncoding:'custom:OldBox',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:1,end:1},error:''};
      const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(raw=>localStorage.setItem('lambda-lab-v2',JSON.stringify(raw)),raw);await page.goto(base);
      await page.waitForFunction(()=>document.getElementById('decoded').textContent==='0_OldBox');assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');await context.close();
    });
    assert.deepEqual(errors,[]);console.log(`Automatic numeral encoding: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
