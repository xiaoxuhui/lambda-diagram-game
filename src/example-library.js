(function(root){
  'use strict';
  const P=root.LambdaPresets||require('./presets.js'),G=root.LambdaGuide||require('./guide.js');
  const C=root.LambdaCore||require('./core.js'),L=root.LambdaLibrary||require('./library.js');
  const chapter=example=>example.category||'入门';
  // Merge the original definitions once, without renaming or expanding them.
  function collect(indices,precision=6){
    const definitions=new Map(),examples=[...new Set(indices)],empty=[];
    for(const index of examples){
      if(!Number.isInteger(index)||!P.examples[index])throw new C.LambdaError('所选示例不存在。');
      const example=P.examples[index],symbols=G.lesson(example,precision).symbols;
      if(!symbols.length)empty.push(example.name);
      for(const definition of symbols){
        const previous=definitions.get(definition.name);
        if(previous&&previous.source!==definition.source)throw new C.LambdaError('所选示例的同名定义不一致：'+definition.name+'。请分别加入这些示例。');
        if(!previous)definitions.set(definition.name,definition);
      }
    }
    return {definitions:[...definitions.values()],examples,empty};
  }
  function init(api){
    const $=id=>document.getElementById(id),category=$('library-category'),search=$('library-search'),list=$('library-examples');
    const selected=new Set(),categories=[...new Set(P.examples.map(chapter))];let busy=false;
    for(const name of categories){const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option);}
    const visible=()=>P.examples.flatMap((example,index)=>(!category.value||chapter(example)===category.value)&&`${example.name} ${G.titleFor(example)} ${chapter(example)} ${example.description??''}`.toLowerCase().includes(search.value.trim().toLowerCase())?[index]:[]);
    function updateSelection(){
      $('library-selection-count').textContent=`已选择 ${selected.size} 个示例（包含筛选外的选择）`;
      $('library-add-selected').disabled=busy||!selected.size;
      $('library-clear-selection').disabled=busy||!selected.size;
    }
    async function add(indices,label){
      if(busy||!indices.length)return;
      const precision=api.precision(),collision=api.collisionPolicy(),feedback=$('library-import-feedback');
      busy=true;feedback.hidden=false;feedback.classList.remove('error');feedback.textContent=`正在准备${label}的函数定义…`;
      const controls=[...$('library-panel').querySelectorAll('button,input,select')].map(control=>[control,control.disabled]);
      for(const [control]of controls)control.disabled=true;
      try{
        await new Promise(resolve=>setTimeout(resolve,0));
        const batch=collect(indices,precision);
        if(!batch.definitions.length){feedback.textContent='所选示例没有命名函数定义，无需加入函数库。';return;}
        const result=api.addFunctions(batch.definitions,null,{exact:true,collision});
        feedback.textContent=`${label}：已处理 ${batch.examples.length} 个示例，合并为 ${batch.definitions.length} 个函数。${L.importFeedback(result)}`+(batch.empty.length?` ${batch.empty.length} 个示例没有命名函数，无需添加。`:'');
      }catch(error){feedback.classList.add('error');feedback.textContent=error.message;}
      finally{busy=false;for(const [control,disabled]of controls)control.disabled=disabled;updateSelection();}
    }
    function render(){
      const indices=visible();list.replaceChildren();
      $('library-example-count').textContent=`显示 ${indices.length} / ${P.examples.length} 个示例 · ${categories.length} 个章节`;
      $('library-select-visible').disabled=busy||!indices.length;
      $('library-empty').hidden=!!indices.length;
      for(const name of categories){
        const items=indices.filter(index=>chapter(P.examples[index])===name);if(!items.length)continue;
        const section=document.createElement('section'),heading=document.createElement('div'),title=document.createElement('h2'),addChapter=document.createElement('button');
        section.className='library-chapter';section.dataset.category=name;heading.className='library-chapter-heading';title.textContent=`${name} · ${P.examples.filter(example=>chapter(example)===name).length} 个示例`;
        addChapter.type='button';addChapter.className='button';addChapter.textContent='整章加入';addChapter.setAttribute('aria-label',`将${name}整章加入函数库`);
        addChapter.addEventListener('click',()=>add(P.examples.flatMap((example,index)=>chapter(example)===name?[index]:[]),`章节「${name}」`));heading.append(title,addChapter);section.append(heading);
        for(const index of items){
          const example=P.examples[index],row=document.createElement('div'),label=document.createElement('label'),checkbox=document.createElement('input'),copy=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small'),button=document.createElement('button');
          row.className='library-example';row.dataset.index=index;checkbox.type='checkbox';checkbox.checked=selected.has(index);checkbox.setAttribute('aria-label',`选择示例 ${example.name}`);
          checkbox.addEventListener('change',()=>{if(checkbox.checked)selected.add(index);else selected.delete(index);updateSelection();});
          title.textContent=G.titleFor(example);description.textContent=example.description??'';copy.append(title,description);label.append(checkbox,copy);
          button.type='button';button.className='button';button.textContent='加入函数库';button.setAttribute('aria-label',`加入示例 ${example.name} 到函数库`);button.addEventListener('click',()=>add([index],`示例「${example.name}」`));row.append(label,button);section.append(row);
        }
        list.append(section);
      }
      updateSelection();
    }
    category.addEventListener('change',render);search.addEventListener('input',render);
    $('library-select-visible').addEventListener('click',()=>{for(const index of visible())selected.add(index);render();});
    $('library-clear-selection').addEventListener('click',()=>{selected.clear();render();});
    $('library-add-selected').addEventListener('click',()=>add([...selected],'所选示例'));
    $('library-add-all').addEventListener('click',()=>add(P.examples.map((_,index)=>index),'全部示例'));
    render();return {refresh:render};
  }
  const API={collect,init};root.LambdaExampleLibrary=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
