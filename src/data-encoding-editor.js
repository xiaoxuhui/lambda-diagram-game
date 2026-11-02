(function(root){
  'use strict';
  const E=root.LambdaDataEncoding,$=id=>document.getElementById(id);
  function init(api){
    let entries=[],editing=null;
    const error=message=>{$('encoding-error').textContent=message;$('encoding-error').hidden=!message;};
    function buttons(){
      $('encoding-save').textContent=editing===null?'保存新编码':'保存修改';
      $('encoding-delete').disabled=editing===null;
    }
    function options(){
      $('number-encoding').querySelectorAll('[data-custom-encoding]').forEach(option=>option.remove());
      for(const entry of entries){const option=document.createElement('option');option.value=`custom:${entry.name}`;option.textContent=`自定义数据 · ${entry.name}`;option.dataset.customEncoding='';$('number-encoding').append(option);}
      if(!['church','decimal',...entries.map(entry=>`custom:${entry.name}`)].includes(api.getSelection()))api.setSelection('church');
      $('number-encoding').value=api.getSelection();buttons();
    }
    function fresh(){editing=null;$('encoding-name').value='';$('encoding-source').value='';error('');buttons();api.queueSave();}
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
    $('encoding-delete').addEventListener('click',()=>{
      if(editing===null)return;
      const name=editing;entries=entries.filter(entry=>entry.name!==name);
      fresh();options();api.onChange();api.toast(`已删除编码 ${name}`);
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
