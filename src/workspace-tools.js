(function(root) {
  'use strict';
  const C=root.LambdaCore,L=root.LambdaLibrary,S=root.LambdaSnapshot;
  const AUTO='lambda-lab-v2',CHECKPOINT='lambda-lab-checkpoint-v2',LEGACY='lambda-lab-v1';
  const $=id=>document.getElementById(id);
  function init(api) {
    const cancel=document.createElement('button');cancel.id='function-cancel';cancel.type='button';cancel.className='button';cancel.textContent='取消编辑';cancel.hidden=true;
    $('function-add').before(cancel);
    let functions=[],checkpoint=null,saveTimer=null,restoring=false,editing=null;
    const feedback=(message,error=false)=>{$('save-feedback').hidden=false;$('save-feedback').textContent=message;$('save-feedback').classList.toggle('error',error);};
    function captured() {return {...api.capture(),version:2,savedAt:new Date().toISOString(),functions,functionDraft:{name:$('function-name').value,source:$('function-source').value,...(editing===null?{}:{editing})}};}
    function renderEditMode() {
      $('function-add').textContent=editing===null?'新增函数 +':'保存修改 ✓';
      $('function-cancel').hidden=editing===null;$('function-edit-status').hidden=editing===null;
      $('function-edit-status').textContent=editing===null?'':`正在编辑：${editing}`;
    }
    function clearEditor() {
      editing=null;$('function-name').value='';$('function-source').value='';$('function-error').hidden=true;renderEditMode();
    }
    function storageStatus(ok) {
      $('storage-status').textContent=ok?'当前状态已自动保存':'自动保存不可用，请导出存档备份';$('storage-status').classList.toggle('storage-error',!ok);
    }
    function persist() {
      clearTimeout(saveTimer);if(restoring)return;
      try{localStorage.setItem(AUTO,S.encode(captured()));storageStatus(true);}catch{storageStatus(false);}
    }
    function queueSave(){if(!restoring){clearTimeout(saveTimer);saveTimer=setTimeout(persist,180);}}
    function renderLibrary() {
      $('function-count').textContent=`${functions.length} 个函数`;const list=$('function-list');list.replaceChildren();
      if(!functions.length){const p=document.createElement('p');p.className='function-empty';p.textContent='还没有自定义函数，先保存一个试试。';list.append(p);}
      functions.forEach(fn=>{
        const row=document.createElement('div');row.className='function-item';row.dataset.name=fn.name;
        const head=document.createElement('div');head.className='function-item-head';const title=document.createElement('strong');title.textContent=fn.name;
        const buttons=document.createElement('div');buttons.className='function-item-buttons';
        const insert=document.createElement('button');insert.textContent='插入';insert.setAttribute('aria-label',`插入函数 ${fn.name}`);
        insert.addEventListener('mousedown',e=>e.preventDefault());insert.addEventListener('click',()=>api.insertFunction(fn.name));
        const edit=document.createElement('button');edit.textContent='编辑';edit.setAttribute('aria-label',`编辑函数 ${fn.name}`);
        edit.addEventListener('click',()=>{
          editing=fn.name;$('function-name').value=fn.name;$('function-source').value=C.format(fn.term);
          $('function-error').hidden=true;renderEditMode();persist();$('function-source').focus();$('function-form').scrollIntoView({block:'nearest'});
        });
        const del=document.createElement('button');del.textContent='删除';del.className='delete-function';del.setAttribute('aria-label',`删除函数 ${fn.name}`);
        del.addEventListener('click',()=>{functions=L.remove(functions,fn.name);if(editing===fn.name)clearEditor();renderLibrary();persist();api.toast(`已删除函数 ${fn.name}`);});
        buttons.append(insert,edit,del);head.append(title,buttons);const definition=document.createElement('code');definition.textContent=C.format(fn.term);row.append(head,definition);list.append(row);
      });
    }
    function apply(snapshot) {
      restoring=true;
      try {functions=snapshot.functions;renderLibrary();api.apply(snapshot);$('function-name').value=snapshot.functionDraft.name;$('function-source').value=snapshot.functionDraft.source;editing=snapshot.functionDraft.editing??null;renderEditMode();$('function-error').hidden=true;}
      finally{restoring=false;}
    }
    function restoreInitial() {
      let restored=false;
      try {
        const text=localStorage.getItem(AUTO)||localStorage.getItem(LEGACY);
        if(text){const snapshot=S.decode(text);apply(snapshot);restored=true;}
      }catch(e){feedback(`自动存档未能恢复：${e.message}。可以重新导入备份。`,true);}
      try{const text=localStorage.getItem(CHECKPOINT);if(text){S.decode(text);checkpoint=text;}}catch{/* Keep a corrupt checkpoint untouched. */}
      $('restore-state').disabled=!checkpoint;renderLibrary();return restored;
    }
    $('function-form').addEventListener('submit',e=>{
      e.preventDefault();$('function-error').hidden=true;
      try {const name=$('function-name').value.trim(),source=$('function-source').value;functions=editing===null?L.add(functions,name,source):L.update(functions,editing,name,source);renderLibrary();clearEditor();persist();api.toast(`已保存函数 ${name}`);}
      catch(error){$('function-error').textContent=error.message;$('function-error').hidden=false;}
    });
    $('function-cancel').addEventListener('click',()=>{clearEditor();persist();});
    renderEditMode();
    $('function-use-current').addEventListener('click',()=>{$('function-source').value=api.currentExpression();$('function-error').hidden=true;$('function-name').focus();queueSave();});
    $('function-name').addEventListener('input',queueSave);$('function-source').addEventListener('input',queueSave);
    document.querySelectorAll('[data-function-insert]').forEach(b=>{b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>{const field=$('function-source');field.setRangeText(b.dataset.functionInsert,field.selectionStart,field.selectionEnd,'end');field.focus();queueSave();});});
    $('save-state').addEventListener('click',()=>{
      try{const text=S.encode(captured());localStorage.setItem(CHECKPOINT,text);checkpoint=text;$('restore-state').disabled=false;persist();feedback('当前状态和关卡进度已保存。可随时恢复到这个位置。');api.toast('当前状态已保存');}
      catch(e){feedback(`未能保存到浏览器：${e.message}。请使用「导出存档」备份当前状态。`,true);}
    });
    $('restore-state').addEventListener('click',()=>{
      if(!checkpoint)return;
      try{const snapshot=S.decode(checkpoint);apply(snapshot);persist();feedback('已恢复保存时的状态。自动运行保持暂停，可单步或继续运行。');api.toast('已恢复当前状态');}
      catch(e){feedback(e.message,true);}
    });
    $('export-state').addEventListener('click',()=>{
      try{const text=S.encode(captured());root.LambdaDownload.save(`lambda-lab-save-${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}.json`,text,'application/json');feedback('完整存档已导出。可以在另一台设备导入继续。');}
      catch(e){feedback(e.message,true);}
    });
    $('clear-all').addEventListener('click',()=>{
      try {
        const backup=S.encodeBackup(captured(),checkpoint);
        const empty=S.decode(S.encode({version:2,draft:'',functions:[],functionDraft:{name:'',source:''},completed:[],mode:'free',level:0,
          session:{original:null,steps:0,dirty:false,halt:''},view:{speed:600,scale:1,autoFit:true,panX:0,panY:0,historyOpen:false,helpOpen:false,hintOpen:false},
          selection:{start:0,end:0},error:''}));
        const previous=[AUTO,CHECKPOINT,LEGACY].map(key=>[key,localStorage.getItem(key)]);
        const result=root.LambdaDownload.saveBackup(`lambda-lab-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,backup);
        try {localStorage.setItem(AUTO,S.encode(empty));localStorage.removeItem(CHECKPOINT);localStorage.removeItem(LEGACY);}
        catch(error) {
          for(const [key,text] of previous){try{if(text===null)localStorage.removeItem(key);else localStorage.setItem(key,text);}catch{/* Storage itself may be unavailable; keep the live scene and exported backup. */}}
          throw error;
        }
        clearTimeout(saveTimer);apply(empty);clearEditor();checkpoint=null;$('restore-state').disabled=true;persist();
        feedback(result==='saved'?'备份已保存，所有游戏内容已清空。可导入备份恢复。':'已发起备份下载，所有游戏内容已清空。请保留下载的 JSON 文件；浏览器无法确认最终保存结果。');
        api.toast('已导出备份并清空');
      }catch(e){feedback(`清空未完成：${e.message}。当前现场保留。`,true);}
    });
    $('import-state').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async()=>{
      const file=$('import-file').files[0];$('import-file').value='';if(!file)return;
      try{if(file.size>S.MAX_BYTES)throw new C.LambdaError('存档文件超过 2 MiB 上限。');const snapshot=S.decode(await file.text());
        if(Object.prototype.hasOwnProperty.call(snapshot,'checkpointText')) {
          if(snapshot.checkpointText===null)localStorage.removeItem(CHECKPOINT);else localStorage.setItem(CHECKPOINT,snapshot.checkpointText);
          checkpoint=snapshot.checkpointText;$('restore-state').disabled=checkpoint===null;
        }
        apply(snapshot);persist();feedback('存档已导入，函数库、计算状态和进度均已恢复。');api.toast('存档导入成功');}
      catch(e){feedback(`导入失败：${e.message}。当前现场未改变。`,true);}
    });
    window.addEventListener('pagehide',persist);
    return {expand:t=>L.expand(t,functions),persist,queueSave,restoreInitial};
  }
  root.LambdaWorkspace={init};
})(typeof globalThis!=='undefined'?globalThis:window);
