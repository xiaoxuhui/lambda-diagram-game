(function(root){
  'use strict';
  const E=root.LambdaDataEncoding;
  function init(api){
    const panel=document.createElement('details');panel.className='input-format-panel';panel.id='input-format-panel';
    panel.innerHTML='<summary id="input-format-title">自定义输入形式</summary><form id="input-format-form"><label for="input-format">输入模板 · {n} 表示数字</label><input id="input-format" placeholder="例如 C{n}、{n}c、[{n}]" autocomplete="off" spellcheck="false"><p id="input-format-preview" class="syntax-note"></p><div class="encoding-actions"><button type="submit" id="save-input-format" class="button">保存输入形式</button><button type="button" id="reset-input-format" class="button">恢复默认</button></div><p id="input-format-error" class="error-message" role="alert" hidden></p></form>';
    document.getElementById('custom-data-panel').before(panel);const $=id=>panel.querySelector(`#${id}`);
    let lastSelection=null,lastTemplate=null;
    const current=()=>E.inputFormatFor(api.getSelection(),api.getEntries(),api.getNumberFormats());
    const example=template=>template.replace('{n}',api.getSelection()==='decimal'?'-1.5':api.getSelection()==='int'?'-3':api.getSelection()==='bool'?'1':'3');
    function preview(){
      try{E.validateTemplate($('input-format').value);$('input-format-preview').textContent=`例如：${example($('input-format').value)}；标准的「数字_编码名称」仍可使用。`;}
      catch{$('input-format-preview').textContent='用一个 {n} 表示数字，前后可以加字母或符号。';}
    }
    function render(force=false){
      const selection=api.getSelection(),template=current();
      if(force||selection!==lastSelection||template!==lastTemplate){$('input-format').value=template;lastSelection=selection;lastTemplate=template;$('input-format-error').hidden=true;}
      $('input-format-title').textContent=`输入形式 · ${example(template)}`;preview();
    }
    function save(template){
      const selection=api.getSelection();
      if(selection.startsWith('custom:'))api.setCustomFormat(selection.slice(7),template);
      else{
        const formats={...api.getNumberFormats()};
        if(template===`{n}_${selection}`)delete formats[selection];else formats[selection]=template;
        E.validateFormats(api.getEntries(),formats);api.setNumberFormats(formats);
      }
      render(true);api.onChange();api.toast('输入形式已保存');
    }
    $('input-format-form').addEventListener('submit',event=>{
      event.preventDefault();try{save($('input-format').value);}catch(error){$('input-format-error').textContent=error.message;$('input-format-error').hidden=false;}
    });
    $('reset-input-format').addEventListener('click',()=>{const selection=api.getSelection();try{save(`{n}_${selection.startsWith('custom:')?selection.slice(7):selection}`);}catch(error){$('input-format-error').textContent=error.message;$('input-format-error').hidden=false;}});
    $('input-format').addEventListener('input',()=>{$('input-format-error').hidden=true;preview();api.queueSave();});
    render();
    return {render,capture:()=>({encoding:api.getSelection(),text:$('input-format').value}),restore(draft){render(true);if(draft?.encoding===api.getSelection()){$('input-format').value=draft.text;preview();}panel.open=!!draft&&draft.encoding===api.getSelection()&&draft.text!==current();}};
  }
  root.LambdaInputFormatEditor={init};
})(window);
