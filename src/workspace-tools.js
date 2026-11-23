(function(root) {
  'use strict';
  const C=root.LambdaCore,L=root.LambdaLibrary,S=root.LambdaSnapshot;
  const AUTO='lambda-lab-v2',CHECKPOINT='lambda-lab-checkpoint-v2',LEGACY='lambda-lab-v1';
  const decode=text=>S.decode(text,{compact:true});
  const $=id=>document.getElementById(id);
  function init(api) {
    const cancel=document.createElement('button');cancel.id='function-cancel';cancel.type='button';cancel.className='button';cancel.textContent='取消编辑';cancel.hidden=true;
    $('function-add').before(cancel);
    let functions=[],checkpoint=null,saveTimer=null,restoring=false,editing=null,functionController=null,collision='skip';
    let replayController=null,recoveredDraft=null,recoveredSession=null,storageLocked=true;
    const restoreDialog=$('restore-progress');
    let lastAuto=null,lastCaptured=null;
    const signature=snapshot=>{const {savedAt,...state}=snapshot;return JSON.stringify(state);};
    function syncCollisionControls(){document.querySelectorAll('[data-function-collision]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.functionCollision===collision)));}
    function attachCollisionControls(parent,before=null){
      const group=document.createElement('div');group.className='function-collision-controls';group.setAttribute('role','group');group.setAttribute('aria-label','函数重名处理');
      const label=document.createElement('span');label.textContent='函数重名时：';group.append(label);
      for(const [value,text]of [['replace','重名替换'],['rename','重名加数字'],['skip','重名跳过'],['reuse','重名直接使用']]){
        const button=document.createElement('button');button.type='button';button.className='button';button.dataset.functionCollision=value;button.textContent=text;button.setAttribute('aria-pressed',String(collision===value));
        button.addEventListener('click',()=>{collision=value;syncCollisionControls();persist();});group.append(button);
      }
      parent.insertBefore(group,before);return group;
    }
    attachCollisionControls($('function-form').parentElement,$('function-form'));
    attachCollisionControls($('guide-add-library').parentElement,$('guide-add-library'));
    attachCollisionControls($('combinator-status').parentElement,$('combinator-status'));
    function cancelReplay(){replayController?.abort();}
    $('cancel-restore').addEventListener('click',cancelReplay);
    restoreDialog.addEventListener('cancel',event=>{event.preventDefault();cancelReplay();});
    async function replaySave(text){
      cancelReplay();
      const controller=new AbortController();replayController=controller;
      try{return await S.decodeAsync(text,{signal:controller.signal,onProgress:(step,total)=>{
        $('restore-progress-text').textContent=`正在重放存档 ${step} / ${total} 步…`;
        if(!restoreDialog.open)restoreDialog.showModal();
      }});}finally{
        if(replayController===controller){replayController=null;restoreDialog.close();}
      }
    }
    function abortFunctionCompile(){functionController?.abort();functionController=null;}
    const feedback=(message,error=false)=>{$('save-feedback').hidden=false;$('save-feedback').textContent=message;$('save-feedback').classList.toggle('error',error);};
    function captured() {
      const snapshot={...api.capture(),version:2,savedAt:new Date().toISOString(),functions,functionDraft:{name:$('function-name').value,source:$('function-source').value,...(editing===null?{}:{editing})}};
      snapshot.view.functionCollision=collision;
      if(recoveredSession)snapshot.session={...recoveredSession,dirty:recoveredSession.dirty||snapshot.draft!==recoveredDraft};
      return snapshot;
    }
    function renderEditMode() {
      $('function-add').textContent=functionController?'正在编码…':editing===null?'新增函数 +':'保存修改 ✓';$('function-add').disabled=!!functionController;
      $('function-cancel').hidden=editing===null&&!functionController;$('function-cancel').textContent=functionController?'取消编码':'取消编辑';$('function-edit-status').hidden=editing===null;
      $('function-edit-status').textContent=editing===null?'':`正在编辑：${editing}`;
    }
    function clearEditor() {
      abortFunctionCompile();
      editing=null;$('function-name').value='';$('function-source').value='';$('function-error').hidden=true;renderEditMode();
    }
    function storageStatus(ok) {
      $('storage-status').textContent=ok?'当前状态已自动保存':'自动保存不可用，请导出存档备份';$('storage-status').classList.toggle('storage-error',!ok);
    }
    function writableCurrent(allowProtected=false){
      const current=localStorage.getItem(AUTO);
      if(current!==lastAuto){
        storageLocked=true;
        throw new C.LambdaError('另一个页面已保存新状态，已停止本页写入，避免旧页面覆盖新存档。请导出本页现场后再重新载入。');
      }
      if(storageLocked&&!allowProtected)throw new C.LambdaError('原自动存档仍在保护中，请先导出原存档，或导入有效的备份。');
      return current;
    }
    function storeSnapshot(snapshot,{checkpointText,removeLegacy=false,allowProtected=false}={}){
      const encoded=S.encode(snapshot),current=writableCurrent(allowProtected),targets=[[AUTO,encoded,current]];
      if(checkpointText!==undefined)targets.push([CHECKPOINT,checkpointText,localStorage.getItem(CHECKPOINT)]);
      if(removeLegacy)targets.push([LEGACY,null,localStorage.getItem(LEGACY)]);
      if(current!==null&&current!==encoded)localStorage.setItem('lambda-lab-previous-v2',current);
      const oldCheckpoint=targets.find(([key])=>key===CHECKPOINT);
      if(oldCheckpoint&&oldCheckpoint[2]!==null&&oldCheckpoint[1]!==oldCheckpoint[2])localStorage.setItem('lambda-lab-checkpoint-previous-v2',oldCheckpoint[2]);
      const changed=[];
      try{
        for(const [key,value,previous]of targets){
          if(value===previous&&key!==LEGACY)continue;
          if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
          changed.push([key,previous]);
        }
      }catch(error){
        let rollbackFailed=false;
        for(const [key,value]of changed.reverse()){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{rollbackFailed=true;}}
        throw new C.LambdaError(`存档写入失败：${error.message}${rollbackFailed?'。回滚未能全部完成，上一版原文备份仍保留。':''}`);
      }
      lastAuto=encoded;lastCaptured=signature(snapshot);storageLocked=false;storageStatus(true);return encoded;
    }
    function persist(force=false) {
      clearTimeout(saveTimer);if(restoring||replayController||storageLocked)return false;
      try{
        const snapshot=captured();
        if(!force&&signature(snapshot)===lastCaptured)return true;
        storeSnapshot(snapshot);return true;
      }catch(error){storageStatus(false);feedback(`自动保存失败：${error.message}。请导出存档备份。`,true);return false;}
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
          abortFunctionCompile();
          editing=fn.name;$('function-name').value=fn.name;$('function-source').value=fn.source??C.format(fn.term);
          $('function-error').hidden=true;renderEditMode();persist();$('function-source').focus();$('function-form').scrollIntoView({block:'nearest'});
        });
        const del=document.createElement('button');del.textContent='删除';del.className='delete-function';del.setAttribute('aria-label',`删除函数 ${fn.name}`);
        del.addEventListener('click',()=>{functions=L.remove(functions,fn.name);if(editing===fn.name)clearEditor();renderLibrary();persist();api.toast(`已删除函数 ${fn.name}`);});
        buttons.append(insert,edit,del);head.append(title,buttons);const definition=document.createElement('code');definition.textContent=C.format(fn.term);row.append(head,definition);list.append(row);
      });
    }
    function apply(snapshot) {
      abortFunctionCompile();
      recoveredDraft=null;recoveredSession=null;
      restoring=true;
      try {functions=snapshot.functions;collision=snapshot.view.functionCollision??'skip';syncCollisionControls();renderLibrary();api.apply(snapshot);$('function-name').value=snapshot.functionDraft.name;$('function-source').value=snapshot.functionDraft.source;editing=snapshot.functionDraft.editing??null;renderEditMode();$('function-error').hidden=true;}
      finally{restoring=false;}
    }
    function recoverDraft(text,message,draftOnly=false){
      const snapshot=S.decodeStartingState(text,{draftOnly});
      apply(snapshot);recoveredDraft=snapshot.draft;checkpoint=text;
      const original=JSON.parse(text);if([2,3,4,5].includes(original.version))recoveredSession=S.validate(original).session;
      $('storage-status').textContent='已保留原自动存档';
      feedback(message);
    }
    async function restoreInitial() {
      let restored=false,text;
      try {
        lastAuto=localStorage.getItem(AUTO);text=lastAuto||localStorage.getItem(LEGACY);
        if(text){
          storageLocked=true;
          if(new URLSearchParams(location.search).get('recover')==='1'){
            recoverDraft(text,'已打开草稿，原存档保留。可点击「恢复已保存状态」重放。',true);
          }else{
            const snapshot=await replaySave(text);apply(snapshot);storageStatus(true);
          }
          restored=true;
          storageLocked=false;
        }else storageLocked=false;
      }catch(e){
        if(e.name==='AbortError'&&text){
          recoverDraft(text,'已取消重放。原存档保留，可点击「恢复已保存状态」重新重放。');
          storageLocked=false;
          restored=true;
        }else {
          storageLocked=true;restored=true;
          feedback(`自动存档未能恢复：${e.message}。原存档已保留，自动写入已暂停，避免覆盖。请先导出原存档。`,true);
          $('storage-status').textContent='原存档已保护，未覆盖';
          const exportOriginal=document.createElement('button');exportOriginal.type='button';exportOriginal.className='button';exportOriginal.textContent='导出原存档';exportOriginal.id='export-original-save';
          exportOriginal.addEventListener('click',()=>root.LambdaDownload.save('lambda-lab-original-save.json',text,'application/json'));
          $('save-feedback').after(exportOriginal);
        }
      }
      try{const saved=localStorage.getItem(CHECKPOINT);if(saved&&!checkpoint){S.decodeStartingState(saved);checkpoint=saved;}}catch{/* Keep a corrupt checkpoint untouched. */}
      $('restore-state').disabled=!checkpoint;renderLibrary();
      if(restored&&!storageLocked){if(!lastAuto)persist();else lastCaptured=signature(captured());}
      return restored;
    }
    $('function-form').addEventListener('submit',async e=>{
      e.preventDefault();$('function-error').hidden=true;
      abortFunctionCompile();const controller=new AbortController();functionController=controller;renderEditMode();
      try {
        const name=$('function-name').value.trim(),source=$('function-source').value,encoding=api.getNumberEncoding?.()||'decimal',precision=api.getDecimalPlaces?.()??6,entries=api.getDataEncodings?.()??null,target=editing,policy=collision;
        if(policy==='reuse'&&functions.some(fn=>fn.name===name&&fn.name!==target)){feedback('已直接使用同名函数：'+name+'（沿用现有定义）。');api.toast('已直接使用同名函数：'+name);persist();return;}
        const original=functions.find(fn=>fn.name===target),prepared=api.compileSource&&source!==original?.source?await api.compileSource(source,controller.signal):null;
        if(controller.signal.aborted||functionController!==controller)return;
        const existing=functions.find(fn=>fn.name===name&&fn.name!==target);let actual=name;
        if(existing){
          const candidate=prepared?.term??(source===original?.source?original.term:root.LambdaDataEncoding.parse(source,entries??[],Infinity,encoding).term);
          if(C.equal(existing.term,L.expand(candidate,functions))){feedback('已有相同定义，已准备好：'+name+'。');api.toast('已有相同定义：'+name);persist();return;}
          if(policy==='skip'){feedback('重名已跳过：'+name+'。草稿保留，可切换处理方式后重试。');api.toast('重名已跳过：'+name);persist();return;}
          if(policy==='rename'){
            const same=functions.find(fn=>fn.name.startsWith(name)&&/^[0-9]+$/.test(fn.name.slice(name.length))&&C.equal(fn.term,L.expand(candidate,functions)));
            if(same){feedback('已有相同定义，已准备好：'+same.name+'。');api.toast('已有相同定义：'+same.name);persist();return;}
            actual=L.availableName(name,functions,C.freeVars(candidate));
          }
        }
        if(target===null)functions=existing&&policy==='replace'?L.update(functions,name,name,source,encoding,precision,entries,prepared):L.add(functions,actual,source,C.LIMITS.chars,encoding,precision,entries,prepared);
        else functions=L.update(existing&&policy==='replace'?L.remove(functions,name):functions,target,actual,source,encoding,precision,entries,prepared);
        renderLibrary();clearEditor();const saved=persist(),message=existing?policy==='replace'?'重名已替换：'+actual:'重名已加数字：'+name+' → '+actual:'已保存函数 '+actual;feedback(saved?message+'。':message+'。尚未保存到浏览器，请导出存档。');api.toast(message);
      }
      catch(error){if(!controller.signal.aborted){$('function-error').textContent=error.message;$('function-error').hidden=false;}}
      finally{if(functionController===controller){functionController=null;renderEditMode();}}
    });
    $('function-cancel').addEventListener('click',()=>{if(functionController){abortFunctionCompile();renderEditMode();return;}clearEditor();persist();});
    renderEditMode();
    $('function-use-current').addEventListener('click',()=>{abortFunctionCompile();renderEditMode();$('function-source').value=api.currentExpression();$('function-error').hidden=true;$('function-name').focus();queueSave();});
    for(const id of ['function-name','function-source'])$(id).addEventListener('input',()=>{abortFunctionCompile();renderEditMode();queueSave();});
    document.querySelectorAll('[data-function-insert]').forEach(b=>{b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>{abortFunctionCompile();renderEditMode();const field=$('function-source');field.setRangeText(b.dataset.functionInsert,field.selectionStart,field.selectionEnd,'end');field.focus();queueSave();});});
    $('save-state').addEventListener('click',()=>{
      try{const snapshot=captured(),text=S.encode(snapshot);storeSnapshot(snapshot,{checkpointText:text});checkpoint=text;$('restore-state').disabled=false;feedback('当前状态和关卡进度已保存。可随时恢复到这个位置。');api.toast('当前状态已保存');}
      catch(e){storageStatus(false);feedback(`未能保存到浏览器：${e.message}。请使用「导出存档」备份当前状态。`,true);}
    });
    $('restore-state').addEventListener('click',async()=>{
      if(!checkpoint)return;
      api.pauseForRestore();
      try{const snapshot=await replaySave(checkpoint);storeSnapshot(snapshot,{allowProtected:true});apply(snapshot);lastCaptured=signature(captured());feedback('已恢复保存时的状态。自动运行保持暂停，可单步或继续运行。');api.toast('已恢复当前状态');}
      catch(e){if(e.name!=='AbortError')storageStatus(false);feedback(e.name==='AbortError'?'已取消重放，当前状态保留。':`恢复失败：${e.message}`,e.name!=='AbortError');}
    });
    $('export-state').addEventListener('click',()=>{
      try{const text=S.encode(captured());root.LambdaDownload.save(`lambda-lab-save-${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}.json`,text,'application/json');feedback('完整存档已导出。可以在另一台设备导入继续。');}
      catch(e){feedback(e.message,true);}
    });
    function replaceWithBackup(snapshot,prefix='lambda-lab-backup'){
      writableCurrent();
      const backup=S.encodeBackup(captured(),checkpoint);
      const result=root.LambdaDownload.saveBackup(`${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,backup);
      storeSnapshot(snapshot,{checkpointText:null,removeLegacy:true});
      clearTimeout(saveTimer);apply(snapshot);clearEditor();checkpoint=null;$('restore-state').disabled=true;lastCaptured=signature(captured());return result;
    }
    $('clear-all').addEventListener('click',()=>{
      try {
        const empty=decode(S.encode({version:2,draft:'',functions:[],functionDraft:{name:'',source:''},completed:[],mode:'free',level:0,
          session:{original:null,steps:0,dirty:false,halt:''},view:{numberEncoding:'church',decimalPlaces:6,speed:600,scale:1,autoFit:true,panX:0,panY:0,historyOpen:false,helpOpen:false,hintOpen:false},
          selection:{start:0,end:0},error:''}));
        const result=replaceWithBackup(empty);
        feedback(result==='saved'?'备份已保存，所有游戏内容已清空。可导入备份恢复。':'已发起备份下载，所有游戏内容已清空。请保留下载的 JSON 文件；浏览器无法确认最终保存结果。');
        api.toast('已导出备份并清空');
      }catch(e){feedback(`清空未完成：${e.message}。当前现场保留。`,true);}
    });
    $('load-default-state').addEventListener('click',()=>{
      try{
        const snapshot=root.LambdaDefaultState.create(),result=replaceWithBackup(snapshot,'lambda-lab-before-default');
        $('custom-data-panel').open=false;$('input-format-panel').open=false;
        feedback((result==='saved'?'原存档备份已保存。':'已发起原存档备份下载。')+'已清空并载入默认存档：集合列表数字、15个函数和1 + 2示例。点击「转换成图示」后运行。');
        api.toast('默认存档已载入');
      }catch(error){feedback(`默认存档未载入：${error.message}。当前现场保留。`,true);}
    });
    $('import-state').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async()=>{
      const file=$('import-file').files[0];$('import-file').value='';if(!file)return;
      api.pauseForRestore();
      try{if(file.size>S.MAX_BYTES)throw new C.LambdaError('存档文件超过 2 MiB 上限。');const snapshot=await replaySave(await file.text());
        storeSnapshot(snapshot,{checkpointText:snapshot.checkpointText,allowProtected:true});
        if(Object.prototype.hasOwnProperty.call(snapshot,'checkpointText')) {
          checkpoint=snapshot.checkpointText;$('restore-state').disabled=checkpoint===null;
        }
        apply(snapshot);lastCaptured=signature(captured());feedback('存档已导入，函数库、计算状态和进度均已恢复。');api.toast('存档导入成功');}
      catch(e){if(e.name==='AbortError')feedback('已取消重放，当前状态保留。');else{storageStatus(false);feedback(`导入失败：${e.message}。当前现场未改变。`,true);}}
    });
    window.addEventListener('pagehide',()=>persist());
    return {expand:t=>L.expand(t,functions),encodingsFor:t=>L.encodingsFor(t,functions),persist,queueSave,restoreInitial,attachCollisionControls,collisionPolicy:()=>collision,
      beginSession:()=>{recoveredDraft=null;recoveredSession=null;},
      functionEntries:()=>functions.slice(),
      saveDefinition:(name,source,prepared)=>{
        const previous=functions;
        const next=functions.some(fn=>fn.name===name)?L.update(functions,name,name,source,'church',6,null,prepared):L.add(functions,name,source,Infinity,'church',6,null,prepared);
        functions=next;
        try{const snapshot=captured();storeSnapshot(snapshot);lastCaptured=signature(snapshot);}
        catch(error){functions=previous;throw error;}
        renderLibrary();
      },
      importDefinitions:(definitions,selected,options={})=>{
        const result=L.importDefinitions(functions,definitions,selected,{collision,...options}),previous=functions;
        functions=result.functions;
        try{const snapshot=captured();storeSnapshot(snapshot);lastCaptured=signature(snapshot);}
        catch(error){functions=previous;throw error;}
        renderLibrary();return result;
      },
      installDefinitions:entries=>{
        let next=functions;
        for(const fn of entries){const existing=next.find(item=>item.name===fn.name);if(existing){if(!C.equal(existing.term,fn.term))throw new C.LambdaError('函数库已修改，请重新编译。');}else next=L.add(next,fn.name,fn.source);}
        functions=next;renderLibrary();
      }};
  }
  root.LambdaWorkspace={init};
})(typeof globalThis!=='undefined'?globalThis:window);
