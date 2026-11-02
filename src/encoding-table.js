(function(root){
  'use strict';
  const C=root.LambdaCore,E=root.LambdaDataEncoding;
  function init(api){
    const panel=document.createElement('section');panel.className='encoding-table';panel.id='encoding-table';
    panel.innerHTML='<h3 id="encoding-table-title">数字 ↔ 表达式对照表</h3><p class="syntax-note">填写数字，生成对应表达式；也可登记当前已归约结果。匹配表中表达式时，结果区会显示数字及编码名称。</p><label for="encoding-table-number">数字</label><input id="encoding-table-number" inputmode="numeric" value="0" autocomplete="off"><div class="encoding-actions"><button type="button" id="encoding-table-generate" class="button">生成并加入</button><button type="button" id="encoding-table-current" class="button">使用当前结果</button><button type="button" id="encoding-table-cancel" class="button" hidden>取消生成</button></div><p id="encoding-table-status" class="syntax-note" role="status"></p><div class="encoding-table-scroll"><table><thead><tr><th>数字</th><th>对应表达式</th><th>操作</th></tr></thead><tbody id="encoding-table-body"></tbody></table></div><p id="encoding-table-empty" class="syntax-note">对照表为空，先生成一个数字。</p>';
    api.host.after(panel);const $=id=>panel.querySelector(`#${id}`);
    let generation=null,timer=null;
    const status=(text,error=false)=>{$('encoding-table-status').textContent=text;$('encoding-table-status').classList.toggle('error-message',error);};
    function cancel(){
      const active=!!generation;clearTimeout(timer);timer=null;generation=null;
      $('encoding-table-generate').disabled=false;$('encoding-table-cancel').hidden=true;
      status(active?'生成已取消，原有对照表保留。':'');
    }
    function render(){
      const entry=api.getEntry();panel.hidden=!entry;
      const body=$('encoding-table-body');body.replaceChildren();if(!entry)return;
      $('encoding-table-title').textContent=`${entry.name} · 数字 ↔ 表达式对照表`;
      for(const row of entry.table??[]){
        const tr=document.createElement('tr');tr.dataset.number=row.number;
        const number=document.createElement('td');number.textContent=`${row.number}_${entry.name}`;
        const expression=document.createElement('td'),code=document.createElement('code');code.textContent=C.format(row.term);expression.append(code);
        const actions=document.createElement('td');
        const edit=document.createElement('button');edit.type='button';edit.textContent='编辑';edit.setAttribute('aria-label',`编辑对照项 ${row.number}`);
        edit.addEventListener('click',()=>{$('encoding-table-number').value=row.number;$('encoding-table-number').focus();status('可重新生成或使用当前结果，保存时替换这条对应关系。');});
        const load=document.createElement('button');load.type='button';load.textContent='载入';load.setAttribute('aria-label',`载入对照项 ${row.number}`);load.addEventListener('click',()=>api.loadTerm(row.term,entry.name));
        const del=document.createElement('button');del.type='button';del.textContent='删除';del.setAttribute('aria-label',`删除对照项 ${row.number}`);
        del.addEventListener('click',()=>{api.setEntries(E.removeMapping(api.getEntries(),entry.name,row.number));render();api.onChange();});
        actions.append(edit,load,del);tr.append(number,expression,actions);body.append(tr);
      }
      $('encoding-table-empty').hidden=!!entry.table?.length;
    }
    function store(name,number,term){api.setEntries(E.putMapping(api.getEntries(),name,number,term));render();api.onChange();}
    $('encoding-table-current').addEventListener('click',()=>{
      try{
        const entry=api.getEntry();if(!entry)throw new C.LambdaError('请先保存数据编码。');
        const term=api.currentTerm();if(!term)throw new C.LambdaError('请先转换并运行一个表达式。');
        store(entry.name,$('encoding-table-number').value,term);status('当前结果已加入对照表。');
      }catch(error){status(error.message,true);}
    });
    $('encoding-table-generate').addEventListener('click',()=>{
      try{
        cancel();const entry=api.getEntry();if(!entry)throw new C.LambdaError('请先保存数据编码。');
        const number=E.naturalNumber($('encoding-table-number').value),term=C.A(entry.term,C.parse(number));
        const task={name:entry.name,number,definition:entry.term,term,steps:0};generation=task;
        $('encoding-table-generate').disabled=true;$('encoding-table-cancel').hidden=false;
        function tick(){
          if(generation!==task)return;
          if(api.getEntry()?.name!==task.name||api.getEntry()?.term!==task.definition){cancel();return;}
          try{
            const start=performance.now();
            do{
              const result=C.step(task.term);
              if(!result){
                generation=null;timer=null;$('encoding-table-generate').disabled=false;$('encoding-table-cancel').hidden=true;
                store(task.name,task.number,task.term);status(`已加入 ${task.number}_${task.name}，生成过程执行 ${task.steps} 次归约。`);return;
              }
              task.term=result.term;task.steps++;
            }while(performance.now()-start<8);
            status(`正在归约 ${task.number}_${task.name}：${task.steps} 步，可随时取消。`);timer=setTimeout(tick,0);
          }catch(error){cancel();status(error.message,true);}
        }
        timer=setTimeout(tick,0);
      }catch(error){cancel();status(error.message,true);}
    });
    $('encoding-table-cancel').addEventListener('click',cancel);
    return {render,cancel};
  }
  root.LambdaEncodingTable={init};
})(window);
