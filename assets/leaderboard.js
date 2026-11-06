'use strict';
(() => {
  const read=id=>JSON.parse(document.getElementById(id).textContent);
  const data=read('benchmark-data'),means={rows:data.summary_rows};
  const speedMetrics=[{key:'FPS',label:'FPS',unit:'frames/s',direction:'max'}];
  const $=id=>document.getElementById(id),metrics=[...data.metrics,...speedMetrics],datasets=[...data.datasets].sort((a,b)=>Number(a.setting==='in-the-wild')-Number(b.setting==='in-the-wild'));
  const folded={};
  const methodIds=data.baselines.map(b=>b.method).filter(m=>!folded[m]),metadata=new Map(data.baselines.map(b=>[b.method,b]));
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={
    'FAcc':['Frame accuracy','Fraction of frames with no detection error.'],
    'F1':['Hand detection F1','Harmonic mean of detection precision and recall.'],
    'MPJPE-abs-p':['Absolute joint error','Mean 3D joint error in camera coordinates, without alignment.'],
    'MPJPE-p':['Wrist-aligned joint error','Mean 3D joint error after aligning the wrists.'],
    'PA-p':['Procrustes-aligned joint error','Mean 3D joint error after Procrustes alignment.'],
    'EPE2D-p':['2D joint error','Mean projected joint error over visible ground-truth joints, with each distance capped at the image diagonal.'],
    'Jitter':['Temporal jitter','Mean acceleration of the predicted joints.'],
    'FPS':['Offline inference speed','Offline FPS on one NVIDIA A100 80 GB GPU, measured on a 400-frame EgoDemo Standard clip at 608 × 480 under a controlled two-hand workload. Missing detections are supplemented with GT-derived boxes for timing only.']
  };
  const scored=data.metrics,arrow=metric=>metric.direction==='max'?'↑':'↓';
  const state={dataset:'mean',sort:'Overall',direction:'max'},expanded=new Set();
  const trainedMethods=new Set((data.variant_rows||[]).map(row=>row.method));
  // Methods that exist only trained on EgoHandBench (no Official weights): one EgoHandBench row, no Official/Pending pair.
  const trainedOnly=new Set(data.baselines.filter(b=>b.trained_on_egohandbench).map(b=>b.method));
  const scopeDatasets=id=>id==='mean'?datasets:datasets.filter(d=>d.id===id);
  const params=new URLSearchParams(location.search);
  if(params.get('dataset')==='mean'||datasets.some(d=>d.id===params.get('dataset')))state.dataset=params.get('dataset');
  // One score column: the overall score on All Datasets, the dataset score on a single dataset.
  const scoreColumns=()=>[{key:'Overall',label:'Score',unit:'pts',direction:'max'}];
  // Column groups: detection, 3D/2D accuracy, temporal, speed, score.
  const groupStart=key=>['FAcc','MPJPE-abs-p','Jitter','FPS','Overall'].includes(key);
  let columns=[...metrics,...scoreColumns()];
  const initialSort=columns.find(metric=>metric.key===params.get('sort'));
  if(initialSort){state.sort=initialSort.key;state.direction=['min','max'].includes(params.get('order'))?params.get('order'):initialSort.direction;}
  const identity=method=>{const row=data.rows.find(r=>r.method===method);return {method,name:metadata.get(method).name,configuration:row?.configuration??null,run_id:metadata.get(method).accuracy_run}};
  const format=(value,key,method)=>Number.isFinite(value)?(value*(['FAcc','F1'].includes(key)?100:1)).toFixed(2):(key==='FPS'&&metadata.get(method)?.speed_pending?'pending':'—');
  const withSpeed=row=>({...row,FPS:metadata.get(row.method)?.fps_offline??null});
  const compare=(key,direction)=>(a,b)=>{const x=a[key],y=b[key];if(!Number.isFinite(x))return Number.isFinite(y)?1:a.name.localeCompare(b.name);if(!Number.isFinite(y))return -1;return (x-y)*(direction==='max'?-1:1)||a.name.localeCompare(b.name)};
  function versionRows(method,dataset=state.dataset){
    const source=dataset==='mean'?means.rows:data.rows.filter(row=>row.dataset===dataset);
    const measured=source.find(row=>row.method===method),score=data.score_rows.find(row=>row.method===method&&row.dataset===dataset);
    const baseline={...identity(method),...measured,...score};
    if(trainedOnly.has(method)){
      const own=withSpeed({...baseline,version:'egohandbench',fps_offline:metadata.get(method)?.fps_offline??null});
      const merged=Object.keys(folded).filter(child=>folded[child]===method).flatMap(child=>versionRows(child,dataset).map(v=>({...v,method,name:baseline.name,version:'egohandbench-'+child})));
      return [own,...merged];
    }
    const official=withSpeed({...baseline,version:'official'});
    const trained=data.variant_rows.find(row=>row.method===method&&row.dataset===dataset);
    const points=data.variant_score_rows.find(row=>row.method===method&&row.dataset===dataset);
    return [official,withSpeed({...identity(method),dataset,version:'egohandbench',run_id:null,configuration:null,...trained,...points,pending:!trained})];
  }
  const tableRows=(dataset=state.dataset)=>methodIds.map(method=>{
    const versions=versionRows(method,dataset);
    return trainedOnly.has(method)?versions[0]:trainedMethods.has(method)?versions.at(-1):versions[0];
  }).sort(compare('Overall','max'));
  const ranked=(rows,key)=>{let rank=0,last=null;return rows.map((r,i)=>{if(last===null||r[key]!==last)rank=i+1;last=r[key];return {...r,rank:Number.isFinite(r[key])?rank:null}})};
  function methodCell(r,link=true){
    const meta=metadata.get(r.method);
    const linked=link&&meta&&meta.source_url&&meta.source_url!=='#';
    const name=linked?`<a class="method-name" href="${esc(meta.source_url)}" target="_blank" rel="noopener noreferrer" title="${esc(meta.source_label)} ${meta.year}">${esc(r.name)}</a>`:`<span class="method-name">${esc(r.name)}</span>`;
    return `<div class="method-title">${name}</div>`;
  }
  function syncUrl(){
    const u=new URL(location.href);for(const key of ['dataset','metric','view','route','q','adapter','sort','order','itw'])u.searchParams.delete(key);
    if(state.dataset!=='mean')u.searchParams.set('dataset',state.dataset);
    if(state.sort!=='Overall'||state.direction!=='max'){u.searchParams.set('sort',state.sort);u.searchParams.set('order',state.direction);}
    try{history.replaceState(null,'',u)}catch(_){}
  }
  const datasetLabel=d=>d.name+(d.setting==='in-the-wild'?' · In-the-Wild':'');
  $('overall-legend').innerHTML=scored.map((metric,i)=>`<span><i style="background:var(--m${i})" aria-hidden="true"></i>${esc(metric.label)}</span>`).join('');
  $('metric-headings').innerHTML=scored.map(metric=>`<span title="${esc(metric.label)} score, 0–100. Higher is better.">${esc(metric.label)}&nbsp;↑</span>`).join('');
  $('dataset-switch').innerHTML=[{id:'mean',name:'All Datasets'},...datasets].map(d=>`<button type="button" data-dataset="${esc(d.id)}" aria-pressed="${d.id===state.dataset}">${esc(d.name)}${d.badge?`<small title="In-the-wild dataset">${esc(d.badge)}</small>`:''}</button>`).join('');
  $('table-sort').innerHTML=columns.map(metric=>`<option value="${esc(metric.key)}">${esc(metric.label)}</option>`).join('');
  function renderTable(){
    columns=[...metrics,...scoreColumns()];
    if(!columns.some(metric=>metric.key===state.sort)){state.sort='Overall';state.direction='max';}
    $('table-sort').innerHTML=columns.map(metric=>`<option value="${esc(metric.key)}">${esc(metric.label)}</option>`).join('');
    const ds=state.dataset==='mean'?{name:'All Datasets'}:datasets.find(d=>d.id===state.dataset),rows=tableRows();
    const metric=columns.find(metric=>metric.key===state.sort),visibleRows=ranked(rows.sort(compare(state.sort,state.direction)),state.sort);
    const direction=state.direction==='max'?'Highest First':'Lowest First';
    $('dataset-switch').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dataset===state.dataset)));
    $('table-title').textContent='Detailed Results · '+datasetLabel(ds);
    const best=Object.fromEntries(columns.map(metric=>[metric.key,(metric.direction==='max'?Math.max:Math.min)(...rows.map(r=>r[metric.key]).filter(Number.isFinite))]));
    const fixedHeaders=[['rank-heading','Rank'],['method-heading','Method']].map(([cls,label])=>`<th scope="col" class="${cls}"><div class="column-heading"><span class="column-label">${label}</span><span class="column-unit" aria-hidden="true">&nbsp;</span></div></th>`).join('');
    $('table-head').innerHTML='<tr>'+fixedHeaders+columns.map(metric=>{
      const active=metric.key===state.sort,nextDirection=active?(state.direction==='max'?'min':'max'):metric.direction;
      const description=(metric.key==='Overall'?(state.dataset==='mean'?'Overall score: 0.5 × mean in-domain dataset score + 0.5 × mean in-the-wild dataset score.':'Dataset score: mean of the metric scores on this dataset.'):labels[metric.key][1])+` ${metric.direction==='max'?'Higher':'Lower'} is better.`;
      return `<th scope="col" class="${groupStart(metric.key)?'group-start':''}" ${active?`aria-sort="${state.direction==='max'?'descending':'ascending'}"`:''}><button type="button" class="column-heading" data-sort="${esc(metric.key)}" aria-controls="table-body" aria-label="${esc(`Sort by ${metric.label}, ${nextDirection==='max'?'highest':'lowest'} first`)}" title="${esc(description)}"><span class="column-label">${esc(metric.heading||metric.label)}${`&nbsp;<i class="metric-direction" title="${metric.direction==='max'?'Higher':'Lower'} is better">${arrow(metric)}</i>`}</span><span class="column-unit">${esc(metric.unit)}</span></button></th>`;
    }).join('')+'</tr>';
    const cells=(r,highlight)=>columns.map(metric=>`<td data-metric="${esc(metric.key)}" data-label="${esc(metric.label)}" data-unit="${esc(metric.unit)}" class="number ${groupStart(metric.key)?'group-start':''} ${highlight&&Number.isFinite(r[metric.key])&&format(r[metric.key],metric.key,r.method)===format(best[metric.key],metric.key,r.method)?'best':''} ${metric.key===state.sort?'sorted-col':''}">${r.version==='egohandbench'&&!Number.isFinite(r[metric.key])?'—':format(r[metric.key],metric.key,r.method)}</td>`).join('');
    $('table-body').innerHTML=visibleRows.map(r=>{
      const versions=versionRows(r.method),open=expanded.has(r.method),prefix=`version-${state.dataset}-${r.method}`;
      const toggle=`<button type="button" class="variant-toggle" data-expand="${esc(r.method)}" aria-expanded="${open}" aria-controls="${versions.map(version=>`${prefix}-${version.version}`).join(' ')}" aria-label="${open?'Collapse':'Expand'} ${esc(r.name)} versions"><svg aria-hidden="true" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${open?'M3 7.5 L6 4.5 L9 7.5':'M3 4.5 L6 7.5 L9 4.5'}"/></svg></button>`;
      const method=methodCell(r,false).replace('<div class="method-title">',`<div class="method-title">${toggle}`);
      const parent=`<tr data-method="${esc(r.method)}" data-version="${r.version}" data-run-id="${esc(r.run_id??'')}" data-configuration="${esc(r.configuration)}"><td class="rank">${r.rank??'—'}</td><th scope="row" class="method-cell" data-toggle-method="${esc(r.method)}">${method}</th>${cells(r,true)}</tr>`;
      const children=versions.map(v=>`<tr id="${prefix}-${v.version}" class="version-row" data-parent-method="${esc(r.method)}" data-version="${v.version}"${open?'':' hidden'}><td class="rank"></td><th scope="row" class="method-cell"><span class="version-label">${v.version==='official'?'Official':'EgoHandBench'}</span>${v.label?`<small>${esc(v.label)}</small>`:''}${v.training_initialization==='author_released_egohandbench'?'<small>Author-released EgoHandBench weights</small>':''}${v.pending?'<small>Pending</small>':''}</th>${cells(v,false)}</tr>`).join('');
      return parent+children;
    }).join('');
    $('table-caption').textContent=`${datasetLabel(ds)}: methods sorted by ${metric.label}, ${direction.toLowerCase()}. Rank follows the selected metric.`;
    $('table-summary').innerHTML=(state.dataset==='mean'?'Metric values: 0.5 × in-domain mean + 0.5 × in-the-wild mean':'Metric values on this dataset')+'<br>Note: By default, results come from EgoHandBench-trained checkpoints when available and from official checkpoints otherwise. Click a method name to view available versions.';
    $('table-sort').value=state.sort;
    $('sort-order').textContent=direction;
    $('sort-order').setAttribute('aria-label',`Sort by ${metric.label}, ${state.direction==='max'?'lowest':'highest'} first`);
    $('table-sort-status').textContent=`Sorted by ${metric.label}, ${direction.toLowerCase()}.`;
    syncUrl();
  }
  function render(){
    const visibleBars=ranked(tableRows('mean'),'Overall');
    const bestScore=Object.fromEntries(scored.map(metric=>[metric.key,Math.max(...visibleBars.map(r=>r.scores?.[metric.key]).filter(Number.isFinite))]));
    $('ranking-title').textContent='Overall Ranking';
    $('ranking-bars').setAttribute('aria-label','Methods ranked by overall score');
    $('metric-direction').textContent='Ranked by Overall Score';
    $('metric-direction').title='Each metric is normalized to 0–100 within each dataset. The overall score gives the in-domain and in-the-wild groups equal weight.';
    $('axis-max').textContent='100 pts';
    $('ranking-bars').innerHTML=visibleBars.map(r=>{
      const segments=r.scores?scored.map((metric,i)=>`<span class="metric-segment" style="flex-basis:${r.scores[metric.key]/scored.length}%;background:var(--m${i})" title="${esc(metric.label)}: ${r.scores[metric.key].toFixed(1)} / 100"></span>`).join(''):'';
      const metricScores=r.scores?scored.map(metric=>`<span class="category-score${r.scores[metric.key].toFixed(1)===bestScore[metric.key].toFixed(1)?' best':''}" data-label="${esc(metric.label)}" aria-label="${esc(metric.label)} score: ${r.scores[metric.key].toFixed(1)} out of 100">${r.scores[metric.key].toFixed(1)}</span>`).join(''):scored.map(metric=>`<span class="category-score" data-label="${esc(metric.label)}">—</span>`).join('');
      return `<li class="bar-row ${r.rank===1?'is-best':''}" data-method="${esc(r.method)}" data-value="${r.Overall}"><span class="rank">${r.rank??'—'}</span><div class="bar-method">${methodCell(r)}</div><div class="bar-track" aria-hidden="true">${segments}</div><div class="category-scores">${metricScores}</div><div class="bar-value">${format(r.Overall,'Overall')}<small>pts</small></div></li>`;
    }).join('');
    renderTable();
    $('fps-note').hidden=false;
    $('fps-note').innerHTML='↑ higher is better · ↓ lower is better · FPS does not affect the score.';
    $('ranking-note').hidden=true;
    syncUrl();
  }
  $('table-body').addEventListener('click',event=>{
    const control=event.target.closest('[data-expand],[data-toggle-method]');if(!control)return;
    const method=control.dataset.expand??control.dataset.toggleMethod;
    if(expanded.has(method))expanded.delete(method);else expanded.add(method);
    renderTable();
    $('table-body').querySelector(`[data-expand="${method}"]`).focus({preventScroll:true});
  });
  $('dataset-switch').addEventListener('click',e=>{const button=e.target.closest('[data-dataset]');if(!button)return;state.dataset=button.dataset.dataset;renderTable()});
  $('table-head').addEventListener('click',e=>{
    const button=e.target.closest('button[data-sort]');if(!button)return;
    const metric=columns.find(metric=>metric.key===button.dataset.sort);
    state.direction=state.sort===metric.key?(state.direction==='max'?'min':'max'):metric.direction;
    state.sort=metric.key;renderTable();
    [...$('table-head').querySelectorAll('button[data-sort]')].find(button=>button.dataset.sort===state.sort).focus({preventScroll:true});
  });
  $('table-sort').addEventListener('change',e=>{state.sort=e.target.value;state.direction=columns.find(metric=>metric.key===state.sort).direction;renderTable()});
  $('sort-order').addEventListener('click',()=>{state.direction=state.direction==='max'?'min':'max';renderTable()});
  $('interactive-board').hidden=false;render();
})();
