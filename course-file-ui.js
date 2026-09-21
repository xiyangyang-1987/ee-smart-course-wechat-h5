(function(){
  'use strict';
  const K=window.COURSE_CORE;
  const esc=K.esc;
  const notify=msg=>{const node=document.getElementById('toast');if(!node)return;node.textContent=msg;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),2600)};
  const account=()=>new URLSearchParams(location.search).get('account')?.trim().slice(0,32)||localStorage.getItem('ee-smart-active')||'课堂小组';
  function renderAnalysis(analysis){
    const box=document.getElementById('ms14-analysis');
    if(!box)return;
    if(!analysis){box.innerHTML='<div class="empty">尚未读取课程工程文件。选择 .ms14 后，系统会在本机解析结构摘要并生成问题、建议与结构评分。</div>';return}
    const counts=analysis.counts||{};
    const dims=(analysis.dimensions||[]).map(d=>'<div class="check-line"><span class="pill '+(d.rate>=85?'green':'red')+'">'+d.score+'/'+d.max+'</span><span><strong>'+esc(d.label)+'</strong><small>维度得分 '+d.rate+'%</small></span></div>').join('');
    box.innerHTML='<div class="banner '+(analysis.score>=85?'good':analysis.score>=60?'warn':'bad')+'"><b>结构评分 '+analysis.score+'/100 · 等级 '+esc(analysis.grade||'—')+' · '+esc(analysis.level)+'</b><br><small>'+esc(analysis.filename)+' · 组件 '+analysis.componentCount+' · 网络覆盖 '+Math.round((analysis.connectionRate||0)*100)+'% · 端口连接率 '+Math.round((analysis.portRate||0)*100)+'%</small><br><small>该分数用于定位课程设计证据缺口，不是课程正式成绩。等级参考：A≥90、B≥80、C≥70、D≥60、E&lt;60。</small></div>'+
      '<div class="metrics"><div class="metric"><b>'+counts.clocks+'</b><span>时基/时钟</span></div><div class="metric"><b>'+counts.counters+'</b><span>计数器</span></div><div class="metric"><b>'+counts.displays+'</b><span>显示/译码</span></div><div class="metric"><b>'+(counts.usedAndGates??counts.andGates)+'</b><span>已接入与门</span></div><div class="metric"><b>'+(counts.openKeyPins||0)+'</b><span>关键引脚悬空</span></div></div>'+
      (analysis.fatal&&analysis.fatal.length?'<div class="banner bad"><b>致命连接缺陷 '+analysis.fatal.length+' 处</b><br><small>'+esc(analysis.fatal.map(x=>x.ref+' '+x.text).join('；'))+'</small></div>':'')+
      (analysis.clockSource&&analysis.clockSource.text?'<div class="banner warn"><b>时钟源</b><br><small>'+esc(analysis.clockSource.text)+'</small></div>':'')+
      '<section class="card"><h3>十维结构评分</h3>'+dims+'</section>'+
      '<div class="grid equal"><section class="card"><h3>文件识别检查</h3>'+analysis.checks.map(x=>'<div class="check-line"><span class="pill '+(x.ok?'green':'red')+'">'+(x.ok?'已识别':'待核对')+'</span><span><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></span></div>').join('')+'</section><section class="card"><h3>系统提出的问题</h3><ol>'+analysis.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ol><h3>建议动作</h3><ul>'+analysis.suggestions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul></section></div>';
  }
  function renderBatch(items){
    const box=document.getElementById('ms14-analysis');
    if(!box)return;
    if(!items?.length){renderAnalysis(null);return}
    const average=Math.round(items.reduce((sum,x)=>sum+x.score,0)/items.length);
    box.innerHTML='<div class="banner"><b>批量读取 '+items.length+' 份课程文件 · 平均结构评分 '+average+'/100</b><br><small>评分用于筛查结构与证据缺口，不是课程正式成绩。点击文件名查看系统问题和建议。</small></div><div class="table-wrap"><table><thead><tr><th>文件</th><th>评分</th><th>等级</th><th>组件</th><th>计数器</th><th>显示</th><th>网络覆盖</th><th>主要问题</th></tr></thead><tbody>'+items.map((x,i)=>'<tr><td><button class="link" data-analysis-index="'+i+'">'+esc(x.filename)+'</button></td><td><b>'+x.score+'</b></td><td>'+(x.grade||'—')+'</td><td>'+x.componentCount+'</td><td>'+x.counts.counters+'</td><td>'+x.counts.displays+'</td><td>'+Math.round(x.connectionRate*100)+'%</td><td>'+esc(x.primaryIssue||x.suggestions?.[0]||x.questions?.[0]||'提交边界波形供教师复核')+'</td></tr>').join('')+'</tbody></table></div><div id="batch-detail"></div>';
    box.querySelectorAll('[data-analysis-index]').forEach(button=>button.addEventListener('click',()=>{const item=items[Number(button.dataset.analysisIndex)];const detail=document.getElementById('batch-detail');detail.innerHTML='<div class="grid equal"><section class="card"><h3>'+esc(item.filename)+' · 问题</h3><ol>'+item.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ol></section><section class="card"><h3>建议动作</h3><ul>'+item.suggestions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul></section></div>';}));
  }
  async function analyzeFile(file){
    if(!/\.ms14$/i.test(file.name))throw Error(file.name+' 不是 .ms14 文件');
    if(file.size>20*1024*1024)throw Error(file.name+' 超过20 MB');
    const decoded=window.MS14Decoder.decode(await file.arrayBuffer());
    return window.CourseFileAnalyzer.analyze(decoded.xml,file.name);
  }
  async function readFiles(fileList){
    const files=[...fileList].filter(file=>/\.ms14$/i.test(file.name));
    if(!files.length)return;
    if(!window.MS14Decoder||!window.CourseFileAnalyzer){notify('课程文件解析模块尚未加载，请刷新页面后重试');return}
    try{
      const analyses=[];
      for(const file of files)analyses.push(await analyzeFile(file));
      if(analyses.length===1){
        const analysis=analyses[0];
        const current=K.readTool(account())||{version:3,account:account(),params:{source:'555',hz:1,counter:'74LS90',display:'DCD_HEX',mode:'24',adjust:'yes'},measurements:{},checks:[],summary:null};
        current.fileAnalysis=analysis;current.fileName=analysis.filename;K.writeTool(account(),current);renderAnalysis(analysis);notify('已读取 '+analysis.filename+'：结构评分 '+analysis.score+'/100');
      }else{
        localStorage.setItem('ee-ms14-batch-v1',JSON.stringify(analyses));renderBatch(analyses);notify('已读取课程文件夹：'+analyses.length+' 份 .ms14');
      }
    }catch(error){renderAnalysis(null);notify('课程文件读取失败：'+error.message)}
  }
  function inject(){
    if(!/engineering-design-tool\.html$/i.test(location.pathname))return;
    if(document.getElementById('ms14-reader')) return;
    const grid=document.querySelector('main .grid');
    if(!grid||!grid.parentElement)return;
    const panel=document.createElement('section');panel.className='card';panel.id='ms14-reader';
    panel.innerHTML='<div class="row between"><div><h2>一 读取课程工程文件</h2><p class="muted">选择单份 .ms14，或由教师一次选择整个“课程文件”文件夹。文件只在当前浏览器内解码，不上传原始电路文件。</p></div><div class="row"><label class="btn">选择单个文件<input id="ms14-file" type="file" accept=".ms14,application/octet-stream" hidden></label><label class="btn">选择课程文件夹<input id="ms14-folder" type="file" accept=".ms14,application/octet-stream" webkitdirectory multiple hidden></label></div></div><div id="ms14-analysis"></div>';
    grid.parentElement.insertBefore(panel,grid);
    document.getElementById('ms14-file').addEventListener('change',e=>readFiles(e.target.files));
    document.getElementById('ms14-folder').addEventListener('change',e=>readFiles(e.target.files));
    const batch=(()=>{try{return JSON.parse(localStorage.getItem('ee-ms14-batch-v1')||'null')}catch(error){return null}})();
    if(batch?.length)renderBatch(batch);else renderAnalysis(K.readTool(account())?.fileAnalysis||null);
  }
  const observer=new MutationObserver(()=>inject());observer.observe(document.body,{childList:true,subtree:true});setTimeout(inject,0);
})();
