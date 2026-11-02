(function(root){
  'use strict';
  const E=root.LambdaDataEncoding,$=id=>document.getElementById(id);
  function init(api){
    let entries=[],editing=null;
    const editStatus=document.createElement('p');editStatus.id='encoding-edit-status';editStatus.className='function-note';$('encoding-form').prepend(editStatus);
    const heading=document.createElement('p');heading.className='function-note';
    const list=document.createElement('div');list.id='encoding-list';list.className='function-list';$('encoding-form').after(heading,list);
    const error=message=>{$('encoding-error').textContent=message;$('encoding-error').hidden=!message;};
    function buttons(){
      $('encoding-save').textContent=editing===null?'保存新编码':'保存修改';
      $('encoding-delete').disabled=editing===null;
      editStatus.hidden=editing===null;editStatus.textContent=editing===null?'':`正在编辑：${editing}`;
    }
    function renderList(){
      heading.textContent=`已保存的数据编码 · ${entries.length} 个`;list.replaceChildren();
      for(const entry of entries){
        const row=document.createElement('div');row.className='function-item';row.dataset.encodingName=entry.name;
        const head=document.createElement('div');head.className='function-item-head';
        const name=document.createElement('strong');name.textContent=entry.name;
        const actions=document.createElement('div');actions.className='function-item-buttons';
        const edit=document.createElement('button');edit.type='button';edit.textContent='编辑';edit.setAttribute('aria-label',`编辑数据编码 ${entry.name}`);
        edit.addEventListener('click',()=>{api.setSelection(`custom:${entry.name}`);select(`custom:${entry.name}`);api.onChange();$('encoding-source').focus();$('encoding-form').scrollIntoView({block:'nearest'});});
        const del=document.createElement('button');del.type='button';del.textContent='删除';del.className='delete-function';del.setAttribute('aria-label',`删除数据编码 ${entry.name}`);del.addEventListener('click',()=>remove(entry.name));
        const source=document.createElement('code');source.textContent=entry.source;
        actions.append(edit,del);head.append(name,actions);row.append(head,source);list.append(row);
      }
    }
    function options(){
      $('number-encoding').querySelectorAll('[data-custom-encoding]').forEach(option=>option.remove());
      for(const entry of entries){const option=document.createElement('option');option.value=`custom:${entry.name}`;option.textContent=`自定义数据 · ${entry.name}`;option.dataset.customEncoding='';$('number-encoding').append(option);}
      if(!['church','decimal',...entries.map(entry=>`custom:${entry.name}`)].includes(api.getSelection()))api.setSelection('church');
      $('number-encoding').value=api.getSelection();buttons();renderList();
    }
    function fresh(){editing=null;$('encoding-name').value='';$('encoding-source').value='';error('');buttons();api.queueSave();}
    function remove(name){
      entries=entries.filter(entry=>entry.name!==name);
      if(editing===name)fresh();options();api.onChange();api.toast(`已删除编码 ${name}`);
    }
    function select(value){
      if(!value.startsWith('custom:'))return;
      const entry=entries.find(entry=>`custom:${entry.name}`===value);if(!entry)return;
      editing=entry.name;$('encoding-name').value=entry.name;$('encoding-source').value=entry.source;
      $('custom-data-panel').open=true;error('');buttons();
    }
    $('encoding-form').addEventListener('submit',event=>{
      event.preventDefault();
      try{
        const name=$('encoding-name').value.trim();
        const original=entries.find(entry=>entry.name===editing),source=$('encoding-source').value;
        // Unchanged definitions retain their compiled dependencies even after library changes.
        if(original&&name===editing&&source===original.source){api.toast(`编码 ${name} 已保存`);return;}
        entries=E.define(entries,name,source,api.expand,editing);editing=name;
        api.setSelection(`custom:${name}`);options();error('');api.onChange();api.toast(`已保存编码 ${name}`);
      }catch(e){error(e.message);}
    });
    $('encoding-new').addEventListener('click',fresh);
    $('encoding-lambda').addEventListener('mousedown',event=>event.preventDefault());
    $('encoding-lambda').addEventListener('click',()=>{
      const field=$('encoding-source');
      field.setRangeText('λ',field.selectionStart,field.selectionEnd,'end');
      field.focus();error('');api.queueSave();
    });
    $('encoding-delete').addEventListener('click',()=>{
      if(editing===null)return;
      remove(editing);
    });
    for(const id of ['encoding-name','encoding-source'])$(id).addEventListener('input',()=>{error('');api.queueSave();});
    options();
    return {
      entries:()=>entries,select,
      capture:()=>({dataEncodings:entries,encodingDraft:{name:$('encoding-name').value,source:$('encoding-source').value,...(editing===null?{}:{editing})}}),
      restore(snapshot){entries=snapshot.dataEncodings??[];const draft=snapshot.encodingDraft??{name:'',source:''};editing=draft.editing??null;$('encoding-name').value=draft.name;$('encoding-source').value=draft.source;options();error('');$('custom-data-panel').open=entries.length>0||!!draft.source;}
    };
  }
  root.LambdaDataEncodingEditor={init};
})(window);
