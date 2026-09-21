(function(){
  'use strict';
  if(/engineering-design-tool\.html$/i.test(location.pathname))return;
  const K=window.COURSE_CORE,C=K.C;
  const F=window.COURSE_FIGURES||{},KB=window.COURSE_KNOWLEDGE||{prep:[],cards:{},graphIntro:''};
  const app=document.getElementById('app'),toastEl=document.getElementById('toast'),dialog=document.getElementById('dialog'),dialogBody=document.getElementById('dialog-body');
  const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},remove(k){try{localStorage.removeItem(k)}catch(e){}}};
  const accountFromUrl=()=>new URLSearchParams(location.search).get('account')?.trim().slice(0,32)||store.get('ee-smart-active')||'';
  let account=accountFromUrl(),state=account?K.load(account):null,role=new URLSearchParams(location.search).get('role')==='teacher'?'teacher':'student';
  let page=role==='teacher'?'review':'prep',openPrep=null,batch=(()=>{try{return JSON.parse(store.get('ee-ms14-batch-v1')||'[]')}catch(e){return[]}})();
  const esc=K.esc;
  const PREP=KB.prep||[],PREP_TOTAL=PREP.length,PREP_QUIZ_TOTAL=PREP.reduce((s,c)=>s+c.quiz.length,0),CARD_KEYS=C.cards.map(c=>c.id),PASS_CARDS=4;
  const GATE_KEY='ee-gate-v3:';
  const MODULES=[{id:'prep',label:'课前预习'},{id:'knowledge',label:'课中知识卡'},{id:'trouble',label:'故障排除'},{id:'archive',label:'工程档案'}];
  /* 每张课中知识卡配一道判据校验题，答对才计入“已掌握”。 */
  const CARD_CHECKS={
    'K1-02':{q:'计数器出现“一次边沿跳多下”，最应优先核对什么？',options:['数码管位序','时钟源用的是 CLOCK_VOLTAGE 还是 DIGITAL_CLOCK','按键 RC 常数'],answer:1},
    'K3-01':{q:'59→00 的进位应当从哪里取出？',options:['7408 与门的复位输出','U2.QC(Pin8) 的下降沿','U2.QD(Pin11)'],answer:1},
    'K4-02':{q:'QD（权值 8）应当接到 DCD_HEX 的哪个引脚？',options:['A（最右）','D（最左）','B（右二）'],answer:1},
    'K4-03':{q:'二十四进制回零检测的是哪一组信号？',options:['U6.QB 与 U5.QC','U6.QA 与 U5.QD','U6.QD 与 U5.QA'],answer:0},
    'K5-01':{q:'按住调分键时一次跳多个数，应优先怎么处理？',options:['增大 RC 时间常数并确认 7414 已接入','减小滤波电容','取消 7432 或门'],answer:0},
    'K1-03':{q:'74LS160 的进位输出是哪个引脚？',options:['QC 下降沿','RCO','QA'],answer:1}
  };
  function toast(m){toastEl.textContent=m;toastEl.classList.add('show');clearTimeout(window.__v2toast);window.__v2toast=setTimeout(()=>toastEl.classList.remove('show'),2600)}
  function openDialog(title,html){document.getElementById('dialog-title').textContent=title;dialogBody.innerHTML=html;if(!dialog.open)dialog.showModal()}
  function save(){try{K.save(state);store.set('ee-smart-active',state.account)}catch(e){toast('当前环境不允许本地保存，请改用 Chrome/Edge 或 https 访问')}}
  function roleLink(){return role==='teacher'?'index.html?account='+encodeURIComponent(account):'index.html?role=teacher'}

  /* ---------------- 四模块门禁 ---------------- */
  const freshGate=()=>({prepRead:[],prepQuiz:{},prepScore:null,cardOpened:[],cardPass:[],cardCheck:{},updatedAt:null});
  function readGate(){try{return Object.assign(freshGate(),JSON.parse(store.get(GATE_KEY+state.account)||'{}'))}catch(e){return freshGate()}}
  function saveGate(g){g.updatedAt=new Date().toISOString();store.set(GATE_KEY+state.account,JSON.stringify(g));return g}
  function prepQuizScore(g){return PREP.reduce((s,c)=>s+c.quiz.filter((q,i)=>g.prepQuiz[c.id+'.'+i]===q.answer).length,0)}
  function gateInfo(g){
    const acct=state?state.account:'';
    const quizScore=prepQuizScore(g),quizNeed=Math.ceil(PREP_QUIZ_TOTAL*2/3);
    const prepOk=g.prepRead.length>=PREP_TOTAL&&quizScore>=quizNeed;
    const cardOk=g.cardPass.length>=PASS_CARDS;
    const tool=acct?K.readTool(acct):null,diagOk=!!(tool&&tool.manualRunAt);
    const archiveOk=state?K.doneCount(state)>=1:false;
    return {
      prep:{ok:prepOk,reasons:[g.prepRead.length<PREP_TOTAL?('还有 '+(PREP_TOTAL-g.prepRead.length)+' 张预习卡未标记掌握'):'',quizScore<quizNeed?('课前自测 '+quizScore+'/'+PREP_QUIZ_TOTAL+'，需至少答对 '+quizNeed+' 题'):''].filter(Boolean)},
      knowledge:{ok:cardOk,reasons:[g.cardPass.length<PASS_CARDS?('已掌握 '+g.cardPass.length+'/'+CARD_KEYS.length+' 张知识卡，需至少 '+PASS_CARDS+' 张'):''].filter(Boolean)},
      trouble:{ok:diagOk,reasons:[diagOk?'':'还没有测量诊断记录，请先完成一次“运行检查并保存”']},
      archive:{ok:archiveOk,reasons:[archiveOk?'':'还没有提交任何阶段证据']},
      quizScore,quizNeed
    };
  }
  function moduleUnlocked(id,info){
    if(id==='prep')return true;
    if(id==='knowledge')return info.prep.ok;
    if(id==='trouble')return info.prep.ok&&info.knowledge.ok;
    return info.prep.ok&&info.knowledge.ok&&info.trouble.ok;
  }
  function moduleLocked(id,info){
    const order=['prep','knowledge','trouble','archive'];
    const blocked=order.slice(0,order.indexOf(id)).filter(m=>!info[m].ok);
    return blocked.length?blocked[blocked.length-1]:null;
  }
  function renderSteps(active,info){
    return '<ol class="v3-steps">'+MODULES.map((m,i)=>{
      const unlocked=moduleUnlocked(m.id,info),ok=info[m.id].ok;
      const cls=unlocked?(ok?'done':(active===m.id?'active':'')):'locked';
      return '<li class="'+cls+'"><b>'+(ok?'✓':String(i+1))+'</b><span>'+m.label+'</span><small>'+(ok?'已通过':(unlocked?(active===m.id?'进行中':'可进入'):'未解锁'))+'</small></li>';
    }).join('')+'</ol>';
  }
  function lockNotice(id,info){
    const blocked=moduleLocked(id,info);
    if(!blocked)return '';
    const label=(MODULES.find(m=>m.id===blocked)||{}).label||blocked;
    const reasons=info[blocked].reasons.length?info[blocked].reasons.join('；'):'请先完成上一模块';
    return '<div class="v3-lock"><b>该模块尚未解锁</b><p>需要先完成<b>'+label+'</b>：'+esc(reasons)+'</p><p class="muted">课程要求按“课前预习 → 课中知识卡 → 故障排除 → 工程档案”的顺序推进，每个阶段都要留下可检查的记录。</p><button class="primary" data-jump="'+blocked+'">前往'+label+'</button></div>';
  }
  function shell(active,body,info){
    const studentNav=[['prep','课前预习'],['knowledge','课中知识卡'],['trouble','故障排除'],['archive','工程档案']];
    const teacherNav=[['review','课后教师评阅'],['overview','班级概览'],['resources','知识卡资源']];
    const items=role==='teacher'?teacherNav:studentNav;
    const nav=items.map(x=>{
      const locked=role==='student'&&!moduleUnlocked(x[0],info);
      return '<button class="'+(active===x[0]?'active':'')+(locked?' locked':'')+'" data-v2-page="'+x[0]+'" '+(locked?'title="尚未解锁"':'')+'>'+x[1]+'</button>';
    }).join('');
    app.innerHTML='<div class="v2-top"><div class="v2-brand"><span class="v2-logo">EE</span><div><b>电工电子课程设计（二）</b><small>'+(role==='teacher'?'教师工作台 · 本地评阅':'学生工作区 · '+(account?('小组 '+esc(account)):'未登录'))+'</small></div></div><div class="v2-top-actions"><span class="v2-save">本地保存</span><a class="v2-role" href="'+roleLink()+'">'+(role==='teacher'?'学生入口':'教师工作台')+'</a></div></div><nav class="v2-nav">'+nav+'</nav>'+(role==='student'?'<div class="v3-steplines">'+renderSteps(active,info)+'</div>':'')+'<main class="v2-container">'+body+'</main>';
    document.querySelectorAll('[data-v2-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.v2Page));
  }
  function navigate(next){
    if(role==='student'&&!state){chooseAccount(()=>render());return}
    if(role==='student'){
      const info=gateInfo(readGate());
      if(!moduleUnlocked(next,info)){page=next;render();return}
    }
    page=next;render();
  }
  function jumpTo(id){page=id;render();window.scrollTo({top:0,behavior:'smooth'})}
  function chooseAccount(done){openDialog('进入学生工作区','<p>请输入教师分配的小组代号。系统不要求姓名、学号或手机号。</p><label>小组代号<input id="v2-account" maxlength="32" placeholder="例如 01 或 A07"></label><div class="form-actions"><button id="v2-account-ok" class="primary">进入课程</button></div>');document.getElementById('v2-account-ok').onclick=()=>{const v=document.getElementById('v2-account').value.trim();if(!v){toast('请先填写小组代号');return}account=v;state=K.load(v);store.set('ee-smart-active',v);dialog.close();done()}}
  function moduleHero(kicker,title,desc,actions){return '<div class="v2-hero"><div><span class="v2-kicker">'+kicker+'</span><h1>'+title+'</h1><p>'+desc+'</p></div><div class="v2-actions">'+(actions||'')+'</div></div>'}
  const bindJumps=()=>document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jumpTo(b.dataset.jump));

  function render(){
    if(role==='student'&&!state){
      const intro=moduleHero('课堂入口','数字电子时钟学习工作区',
        '从课前预习开始，按课中知识卡完成故障排除，最后提交工程档案。四个模块按顺序解锁，不能跳过。',
        '<button class="primary" id="v2-start">输入小组代号</button>')+
        '<div class="v2-onboard">'+
          '<div><b>学生端四模块学习路径</b><p>课前建立概念，课中用知识卡解决问题，课后把 .ms14 文件和测量证据交给教师。</p></div>'+
          '<div class="v2-pathline"><span>课前预习</span><i>→</i><span>课中知识卡</span><i>→</i><span>故障排除</span><i>→</i><span>工程档案</span></div>'+
        '</div>'+
        '<div class="v2-section-title">这个工具能做什么</div>'+
        '<div class="v2-grid3">'+[
          ['课前预习','三张知识卡与课前自测','把时基、计数、译码显示和回零的原理先讲清楚，答对 2/3 才解锁下一模块。'],
          ['课中知识卡','六张诊断卡与知识图谱','每张卡给出原理图、关键参数、测点清单、判据和常见错误，按故障现象回指依据。'],
          ['故障排除','测点 → 判据 → 复测','把现象变成可执行的测量任务，系统给出下一测点和判据，学生自己留下观察与修改依据。'],
          ['工程档案','六阶段证据与教师反馈','提交版本、文件、测点、修改与复测结论；教师导入后逐阶段审核并生成反馈包。']
        ].map(c=>'<article class="v2-card"><span class="v2-kicker">'+c[0]+'</span><h3>'+c[1]+'</h3><p>'+c[2]+'</p></article>').join('')+'</div>'+
        '<div class="v2-callout">全部记录只保存在当前浏览器，不上传姓名、学号或波形文件；正式成绩以 Multisim 源文件、实测、报告和答辩为准。</div>';
      shell('prep',intro,gateInfo(freshGate()));
      document.getElementById('v2-start').onclick=()=>chooseAccount(render);
      return;
    }
    if(role==='teacher'){if(page==='review')renderTeacherReview();else if(page==='overview')renderOverview();else renderResources();return}
    const info=gateInfo(readGate());
    if(!moduleUnlocked(page,info)){renderLocked(page,info);return}
    if(page==='prep')renderPrep(info);else if(page==='knowledge')renderKnowledge(info);else if(page==='trouble')renderTrouble(info);else renderArchive(info);
  }
  function renderLocked(id,info){
    const m=MODULES.find(x=>x.id===id)||{label:id};
    const blocked=moduleLocked(id,info),bl=(MODULES.find(x=>x.id===blocked)||{}).label||blocked;
    const reasons=(info[blocked]||{reasons:[]}).reasons;
    const body=moduleHero('模块尚未解锁',m.label+' 需要先完成 '+bl,
      '课程要求按“课前预习 → 课中知识卡 → 故障排除 → 工程档案”的顺序推进。每个阶段都要留下可检查的记录，系统不会跳步进入下一模块。','')+
      '<div class="v3-lock"><b>还差什么</b>'+(reasons.length?'<ul>'+reasons.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>':'<p>请先完成上一模块的全部要求。</p>')+
      '<p class="muted">当前模块只能通过“学生工作区”的导航进入，直接输入地址也不会绕过门禁——门禁在每次渲染时重新校验。</p><button class="primary" data-jump="'+blocked+'">前往'+bl+' →</button></div>'+
      '<div class="v2-section-title">四个模块的解锁条件</div>'+
      '<div class="v3-unlock-grid">'+MODULES.map((mm,i)=>{
        const need=['3 张预习卡标记掌握 + 课前自测正确率 ≥ 2/3','至少 4 张知识卡通过判据校验','完成一次“运行检查并保存”诊断记录','至少提交 1 个阶段证据'][i];
        const ok=info[mm.id].ok;
        return '<article class="v2-card '+(ok?'done':'')+'"><div class="v2-card-top"><span class="v2-card-index">'+(ok?'✓':'0'+(i+1))+'</span><span class="v2-tag">'+(ok?'已通过':(moduleUnlocked(mm.id,info)?'进行中':'未解锁'))+'</span></div><h3>'+mm.label+'</h3><p>'+esc(need)+'</p></article>';
      }).join('')+'</div>';
    shell(id,body,info);
    bindJumps();
  }

  /* ---------------- 模块一 · 课前预习 ---------------- */
  function renderPrep(info){
    const g=readGate();
    const pct=Math.round((g.prepRead.length/PREP_TOTAL*.5+(info.quizScore/PREP_QUIZ_TOTAL)*.5)*100);
    const body=moduleHero('模块一 · 课前预习','先建立判断依据，再进入仿真调试','三张预习卡来自实验四原理部分，点击卡片即可在页面内展开完整内容（含原理图、参数表和自检清单）。读完后完成课前自测，答对 2/3 以上才能解锁课中知识卡。','')+
      '<div class="v2-progress"><div><b>预习完成度 '+pct+'%</b><small>已掌握 '+g.prepRead.length+'/'+PREP_TOTAL+' 张知识卡 · 自测 '+info.quizScore+'/'+PREP_QUIZ_TOTAL+'（需 '+info.quizNeed+' 题）</small></div><div class="v2-progress-track"><i style="width:'+pct+'%"></i></div></div>'+
      '<div class="v2-section-title">必读知识卡 '+PREP_TOTAL+' 张（点击展开）</div>'+
      '<div class="v3-prep-list">'+PREP.map((c,i)=>{const done=g.prepRead.includes(c.id),open=openPrep===c.id;
        return '<section class="v3-prep-item '+(done?'done':'')+(open?' open':'')+'">'+
          '<button class="v3-prep-head" data-prep-open="'+c.id+'">'+
            '<span class="v2-card-index">'+(done?'✓':'0'+(i+1))+'</span>'+
            '<span class="v3-prep-title"><b>'+esc(c.title)+'</b><small>'+esc(c.summary.slice(0,60))+'…</small></span>'+
            '<span class="v2-tag">'+(done?'已掌握':'建议 '+c.minutes+' 分钟')+'</span>'+
            '<span class="v3-chev">'+(open?'▲':'▼')+'</span></button>'+
          (open?renderPrepBody(c):'')+'</section>';}).join('')+'</div>'+
      '<div class="v2-section-title">课前自测（答对 ≥'+info.quizNeed+' 题）</div><section class="v2-quiz">'+PREP.map((c,ci)=>c.quiz.map((q,qi)=>{
        const key=c.id+'.'+qi,sel=g.prepQuiz[key];
        return '<div class="v2-quiz-item"><b>'+(ci+1)+'.'+(qi+1)+' '+esc(q.q)+'</b><div class="v2-options">'+q.options.map((o,oi)=>'<label class="'+(sel===oi?'picked':'')+'"><input type="radio" name="'+key+'" value="'+oi+'" '+(sel===oi?'checked':'')+'>'+esc(o)+'</label>').join('')+'</div></div>';
      }).join('')).join('')+'<button class="primary" id="v2-submit-quiz">提交课前自测</button></section>'+
      (info.prep.ok?'<div class="v3-lock soft ok"><b>模块已通过</b><p>预习卡与自测均达标，可以进入课中知识卡模块。</p><button class="primary" data-jump="knowledge">前往课中知识卡 →</button></div>':'<div class="v3-lock soft"><b>解锁条件</b><p>'+esc(info.prep.reasons.join('；')||'继续完成预习卡与自测')+'</p></div>');
    shell('prep',body,info);
    document.querySelectorAll('[data-prep-open]').forEach(b=>b.onclick=()=>{openPrep=(openPrep===b.dataset.prepOpen?null:b.dataset.prepOpen);renderPrep(gateInfo(readGate()))});
    document.querySelectorAll('[data-prep-done]').forEach(b=>b.onclick=()=>{const gg=readGate();if(!gg.prepRead.includes(b.dataset.prepDone))gg.prepRead.push(b.dataset.prepDone);saveGate(gg);renderPrep(gateInfo(gg));toast('已记录：预习卡已掌握')});
    document.getElementById('v2-submit-quiz').onclick=()=>{
      const gg=readGate();
      PREP.forEach(c=>c.quiz.forEach((q,qi)=>{const el=document.querySelector('input[name="'+c.id+'.'+qi+'"]:checked');if(el)gg.prepQuiz[c.id+'.'+qi]=Number(el.value)}));
      gg.prepScore=prepQuizScore(gg);saveGate(gg);renderPrep(gateInfo(gg));
      toast('自测完成：'+gg.prepScore+'/'+PREP_QUIZ_TOTAL);
    };
    document.querySelectorAll('.v2-options label').forEach(l=>l.onclick=()=>l.parentElement.querySelectorAll('label').forEach(x=>x.classList.remove('picked')));
    bindJumps();
  }
  function renderPrepBody(c){
    return '<div class="v3-prep-body">'+
      '<p class="v3-lead">'+esc(c.summary)+'</p>'+
      (F[c.fig]?'<figure class="v3-figure">'+F[c.fig]+'<figcaption>图 1：'+esc(c.title)+'</figcaption></figure>':'')+
      '<h3 class="v3-h3">关键要点</h3>'+c.points.map(p=>'<div class="v3-point"><b>'+esc(p.h)+'</b><p>'+esc(p.p)+'</p></div>').join('')+
      (c.fig2&&F[c.fig2]?'<figure class="v3-figure">'+F[c.fig2]+'<figcaption>图 2：配套时序与逻辑</figcaption></figure>':'')+
      (c.table?'<h3 class="v3-h3">配套速查表</h3><div class="table-wrap"><table class="v3-table"><thead><tr>'+c.table.head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+c.table.rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'')+
      '<h3 class="v3-h3">自检清单</h3><ul class="v3-checklist">'+c.checklist.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
      '<div class="form-actions"><button class="primary" data-prep-done="'+c.id+'">我已掌握这张卡</button></div></div>';
  }

  /* ---------------- 模块二 · 课中知识卡 ---------------- */
  function renderKnowledge(info){
    const g=readGate();
    const body=moduleHero('模块二 · 课中知识卡','按故障现象回看依据，再决定下一测点','每张知识卡包含原理示意、关键参数、测点清单、判据与常见错误；完成卡内判据校验题即可标记为已掌握。','')+
      '<div class="v2-progress"><div><b>已掌握 '+g.cardPass.length+'/'+CARD_KEYS.length+' 张</b><small>至少 '+PASS_CARDS+' 张才能解锁故障排除模块</small></div><div class="v2-progress-track"><i style="width:'+Math.round(g.cardPass.length/CARD_KEYS.length*100)+'%"></i></div></div>'+
      '<div class="v2-section-title">课程知识图谱</div>'+
      '<section class="kg-root"><div id="kg-mount-knowledge"></div></section>'+
      '<div class="v2-section-title">诊断知识卡</div>'+
      '<div class="v2-knowledge-layout"><aside class="v2-card-list">'+C.cards.map((c,i)=>{
        const passed=g.cardPass.includes(c.id);
        return '<button class="v2-kcard '+(i===0?'active':'')+(passed?' passed':'')+'" data-card="'+c.id+'"><b>'+c.id+'</b><span>'+esc(c.title)+'</span><small>'+esc(c.source)+(passed?' · 已掌握':'')+'</small></button>';
      }).join('')+'</aside><section id="v2-card-detail" class="v2-knowledge-detail"></section></div>'+
      (info.knowledge.ok?'<div class="v3-lock soft ok"><b>模块已通过</b><p>已掌握 '+g.cardPass.length+' 张知识卡，可以进入故障排除模块。</p><button class="primary" data-jump="trouble">前往故障排除 →</button></div>':'<div class="v3-lock soft"><b>解锁条件</b><p>'+esc(info.knowledge.reasons.join('；'))+'</p></div>');
    shell('knowledge',body,info);
    const show=id=>showCard(id,info);
    const firstCard=pendingCard&&C.cards.some(c=>c.id===pendingCard)?pendingCard:C.cards[0].id;
    pendingCard=null;
    show(firstCard);
    document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{const gg=readGate();if(!gg.cardOpened.includes(b.dataset.card))gg.cardOpened.push(b.dataset.card);saveGate(gg);show(b.dataset.card)});
    mountGraph('kg-mount-knowledge');
    bindJumps();
  }
  let pendingCard=null;
  function mountGraph(id){
    const el=document.getElementById(id);
    if(el&&window.COURSE_GRAPH)window.COURSE_GRAPH.render(el);
  }
  document.addEventListener('kg:openCard',e=>{
    const card=e.detail&&e.detail.card;if(!card)return;
    if(role==='student'){
      pendingCard=card;
      const info=gateInfo(readGate());
      if(!moduleUnlocked('knowledge',info)){jumpTo('knowledge');return}
      page='knowledge';render();
    }else showCardDialog(card);
  });
  function showCardDialog(cardId){
    const c=C.cards.find(x=>x.id===cardId);if(!c)return;
    const kb=KB.cards[cardId]||{};
    openDialog('知识卡 '+c.id+' · '+c.title,
      '<div class="v3-band"><b>原理</b><p>'+esc(kb.principle||c.focus)+'</p></div>'+
      (kb.params?'<h3 class="v3-h3">关键参数</h3><div class="v3-kv">'+kb.params.map(r=>'<div><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>').join('')+'</div>':'')+
      (kb.mistakes?'<h3 class="v3-h3">常见错误</h3><ul class="v3-mistakes">'+kb.mistakes.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
      (kb.probes?'<h3 class="v3-h3">测点清单</h3><ul class="v3-probes">'+kb.probes.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
      '<div class="v2-evidence-box"><b>学生需要留下的证据</b><p>'+esc(c.evidence)+'</p></div>');
  }
  function showCard(id,info){
    const c=C.cards.find(x=>x.id===id)||C.cards[0],ck=CARD_CHECKS[c.id],kb=KB.cards[c.id]||{},g=readGate();
    const passed=g.cardPass.includes(c.id),picked=g.cardCheck&&g.cardCheck[c.id];
    document.getElementById('v2-card-detail').innerHTML=
      '<span class="v2-kicker">课程知识卡 '+c.id+'</span><h2>'+esc(c.title)+'</h2>'+
      (kb.fig&&F[kb.fig]?'<figure class="v3-figure">'+F[kb.fig]+'</figure>':'')+
      '<div class="v3-band"><b>原理</b><p>'+esc(kb.principle||c.focus)+'</p></div>'+
      (kb.params?'<h3 class="v3-h3">关键参数</h3><div class="v3-kv">'+kb.params.map(r=>'<div><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>').join('')+'</div>':'')+
      (kb.probes?'<h3 class="v3-h3">测点清单</h3><ul class="v3-probes">'+kb.probes.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>':'')+
      (kb.checks?'<h3 class="v3-h3">判据</h3><div class="v3-judge">'+kb.checks.map(r=>'<div class="'+(r[0]==='合格'?'ok':'bad')+'"><b>'+esc(r[0])+'</b><p>'+esc(r[1])+'</p></div>').join('')+'</div>':'')+
      (kb.mistakes?'<h3 class="v3-h3">常见错误</h3><ul class="v3-mistakes">'+kb.mistakes.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>':'')+
      '<div class="v2-evidence-box"><b>学生需要留下的证据</b><p>'+esc(c.evidence)+'</p><small>回看资源：'+esc(c.source)+'</small></div>'+
      (ck?'<h3 class="v3-h3">判据校验（答对即标记已掌握）</h3><div class="v3-check"><b>'+esc(ck.q)+'</b><div class="v2-options">'+ck.options.map((o,oi)=>'<label class="'+(picked===oi?'picked':'')+'"><input type="radio" name="v3ck" value="'+oi+'" '+(picked===oi?'checked':'')+' '+((picked!=null)?'disabled':'')+'>'+esc(o)+'</label>').join('')+'</div><div class="row"><button class="primary" id="v3-ck-submit" '+((picked!=null)?'disabled':'')+'>提交校验</button><span class="v3-mark '+(passed?'ok':'')+'">'+(passed?'✓ 已掌握':(picked!=null?'答案不对，再想一次':'未掌握'))+'</span></div></div>':'')+
      '<h3 class="v3-h3">课堂追问</h3><ol class="v3-ask">'+(kb.questions||[]).map(q=>'<li>'+esc(q)+'</li>').join('')+'</ol>'+
      '<small class="v3-source">回看资源：'+esc(c.source)+'</small>';
    const sub=document.getElementById('v3-ck-submit');
    if(sub)sub.onclick=()=>{
      const el=document.querySelector('input[name="v3ck"]:checked');if(!el){toast('请先选择一个答案');return}
      const gg=readGate();gg.cardCheck=gg.cardCheck||{};gg.cardCheck[c.id]=Number(el.value);
      if(Number(el.value)===ck.answer&&!gg.cardPass.includes(c.id)){gg.cardPass.push(c.id);toast('判据校验通过，已标记掌握')}
      else if(Number(el.value)!==ck.answer){delete gg.cardCheck[c.id];toast('答案不对：请回到判据与常见错误再核对一遍')}
      saveGate(gg);renderKnowledge(gateInfo(gg));
    };
    document.querySelectorAll('[data-card]').forEach(x=>x.classList.toggle('active',x.dataset.card===c.id));
  }

  /* ---------------- 模块三 · 故障排除 ---------------- */
  function renderTrouble(info){
    const tool=K.readTool(state.account);
    const body=moduleHero('模块三 · 故障排除','把现象变成可执行的测量任务','选择当前故障，系统结合课程知识卡给出下一测点、判据和修改建议；学生仍需用 Multisim 验证并留下记录。','<button class="primary" id="v2-tool-link">进入测量诊断</button>')+
      '<div class="v3-band '+(tool&&tool.manualRunAt?'ok':'warn')+'"><b>'+(tool&&tool.manualRunAt?'已记录一次诊断':'尚未运行诊断')+'</b><p>'+(tool&&tool.manualRunAt?('记录完整项 '+tool.summary.passed+'/'+tool.summary.total+'，运行时间 '+new Date(tool.manualRunAt).toLocaleString('zh-CN',{hour12:false})):'故障排除模块要求至少完成一次“运行检查并保存”，把实测频率、测点、边界回零和调时记录写进去。')+'</p></div>'+
      '<div class="v2-trouble-layout"><section class="v2-trouble-selector"><h2>选择故障现象</h2>'+Object.entries(C.faults).map(([key,f],i)=>'<button class="v2-fault '+(i===0?'active':'')+'" data-fault="'+key+'"><span>'+String(i+1).padStart(2,'0')+'</span><b>'+f.label+'</b><small>'+f.card+'</small></button>').join('')+'</section><section id="v2-fault-detail" class="v2-fault-detail"></section></div>'+
      (info.trouble.ok?'<div class="v3-lock soft ok"><b>模块已通过</b><p>已有诊断记录，可以进入工程档案提交阶段证据。</p><button class="primary" data-jump="archive">前往工程档案 →</button></div>':'<div class="v3-lock soft"><b>解锁条件</b><p>'+esc(info.trouble.reasons.join('；'))+'</p></div>');
    shell('trouble',body,info);
    const show=key=>{const f=C.faults[key]||C.faults.other,kc=KB.cards[f.card]||{},card=C.cards.find(x=>x.id===f.card);
      document.getElementById('v2-fault-detail').innerHTML='<span class="v2-kicker">'+f.card+' · 工程诊断</span><h2>'+esc(f.label)+'</h2>'+
      '<div class="v2-trouble-step"><b>下一测点</b><p>'+esc(f.next)+'</p></div>'+
      '<div class="v2-trouble-step"><b>判据</b><p>'+esc(f.criterion)+'</p></div>'+
      '<div class="v2-trouble-step accent"><b>建议动作</b><p>'+esc(f.action)+'</p></div>'+
      (card?'<div class="v2-evidence-box"><b>关联知识卡 '+card.id+'</b><p>'+esc(card.title)+'：'+esc((kc.principle||card.focus).slice(0,120))+'</p></div>':'')+
      '<div class="v2-question">学生回答：我观察到什么？我先假设什么？我改了什么？我如何复测？</div>';
      document.querySelectorAll('[data-fault]').forEach(x=>x.classList.toggle('active',x.dataset.fault===key))};
    show('no-count');document.querySelectorAll('[data-fault]').forEach(b=>b.onclick=()=>show(b.dataset.fault));
    document.getElementById('v2-tool-link').onclick=()=>location.href='engineering-design-tool.html?account='+encodeURIComponent(state.account);
    bindJumps();
  }

  /* ---------------- 模块四 · 工程档案 ---------------- */
  function renderArchive(info){
    const done=K.doneCount(state),tool=state.tool||K.readTool(state.account),analysis=tool?.fileAnalysis;
    const openStage=C.stages.find(st=>state.tasks[st.id].status==='todo'||state.tasks[st.id].status==='rework');
    const body=moduleHero('模块四 · 课后提交','把 .ms14、测量记录和教师反馈放进同一份工程档案','课后提交不是上传一个文件，而是提交“文件结构—实测证据—修改结论”的对应关系。六阶段依次解锁，阶段三必须先有一次真实诊断记录。',
        '<button class="primary" id="v2-open-last">'+(openStage?('继续阶段 '+openStage.id):'查看已完成阶段')+'</button>')+
      '<div class="v2-archive-grid"><section class="v2-card"><h2>当前档案</h2><div class="v2-big-number">'+done+'<small>/6 阶段提交</small></div><p>小组代号：'+esc(state.account)+'</p><div class="row"><button id="v2-export-report">导出完整档案</button><button id="v2-import-feedback">导入教师反馈</button></div></section>'+
      '<section class="v2-card"><h2>最近 .ms14 结构分析</h2>'+(analysis?('<div class="v2-score '+(analysis.grade||'').toLowerCase()+'">'+analysis.score+'<small>/100</small></div><p><b>'+esc(analysis.level)+'</b>（等级 '+esc(analysis.grade||'—')+'）</p><p>组件 '+analysis.componentCount+' · 网络覆盖 '+Math.round(analysis.connectionRate*100)+'%</p>'+dimBars(analysis)):'<p class="muted">尚未读取 .ms14 文件。请进入故障排除或测量诊断选择文件。</p>')+'</section></div>'+
      '<div class="v2-section-title">六阶段工程证据</div><section class="v3-stages">'+C.stages.map(st=>{
        const t=state.tasks[st.id],e=t.evidence,locked=t.status==='locked';
        const cls=t.status==='reviewed'?'done':t.status==='submitted'?'wait':t.status==='rework'?'rework':'open';
        return '<article class="v3-stage '+cls+'"><div class="v3-stage-head"><span class="v2-card-index">'+st.id+'</span><div><b>'+esc(st.title)+'</b><small>'+esc(st.short)+'</small></div><span class="v3-pill '+cls+'">'+esc(K.taskStatusText(t))+'</span></div>'+
          '<p class="v3-stage-note">'+esc(e?.note||'尚未填写工程证据')+'</p>'+
          '<small class="v3-stage-meta">'+esc(e?.file||'未关联文件')+' · 修订轮次 '+(t.revision||0)+'</small>'+
          '<div class="row"><button data-stage="'+st.id+'" '+(locked?'disabled':'')+'>'+(locked?'先完成前置阶段':((t.status==='rework'||t.status==='todo')?'填写证据':'查看并补充'))+'</button></div></article>';
      }).join('')+'</section>'+
      '<div class="v2-section-title">教师反馈</div><section class="v2-review-card">'+renderFeedbackList()+'</section>'+
      '<div class="v2-callout">正式成绩仍以 Multisim 源文件、波形/实测、报告和答辩为准。结构评分用于帮助教师安排追问和补交证据，等级按 A≥90、B≥80、C≥70、D≥60、E&lt;60 划分。</div>';
    shell('archive',body,info);
    const last=document.getElementById('v2-open-last');
    last.onclick=()=>openEvidence(openStage?openStage.id:6);
    document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>openEvidence(Number(b.dataset.stage)));
    document.getElementById('v2-export-report').onclick=()=>{
      const blob=new Blob([JSON.stringify(K.buildReport(state),null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='数字电子时钟_'+state.account+'_工程档案.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800);
    };
    document.getElementById('v2-import-feedback').onclick=openFeedbackImport;
  }
  function renderFeedbackList(){
    const items=[];
    C.stages.forEach(st=>(state.tasks[st.id].feedback||[]).forEach(f=>items.push('<div class="v3-fb"><b>阶段'+st.id+' · '+esc(f.decision)+'</b><p>'+esc(f.body)+'</p><small>'+esc(f.reviewer||'教师')+' · '+new Date(f.createdAt).toLocaleString('zh-CN',{hour12:false})+'</small></div>')));
    return items.length?items.slice(-4).join(''):'<p class="muted">教师反馈会在导入反馈包后显示。</p>';
  }
  function openEvidence(id){
    const t=state.tasks[id],st=C.stages[id-1],old=t.evidence||{};
    if(!t||!st)return;
    if(t.status==='locked'){toast('请先完成前置阶段');return}
    const tool=id===3?(state.tool||K.readTool(state.account)):null;
    openDialog('阶段'+id+' · '+st.title,
      '<p>'+esc(st.prompt)+'</p>'+
      (id===3?'<div class="v3-band '+(tool?'ok':'warn')+'"><b>'+(tool?('已记录诊断：'+tool.summary.passed+'/'+tool.summary.total+' 项'):'阶段三必须先完成真实测量诊断')+'</b><p>'+(tool?'教师仍需核对原始波形。':'请先打开“测量诊断”，填写实测频率与测点并点击“运行检查并保存”。')+'</p></div>':'')+
      '<form id="v3-evidence-form"><div class="form-grid">'+
      '<label>关联文件名或路径<input id="ev-file" maxlength="160" value="'+esc(old.file||'')+'" placeholder="例如 group01_clock_v2.ms14"></label>'+
      '<label>本轮修改版本<input id="ev-ver" maxlength="40" value="'+esc(old.version||('v'+((t.revision||0)+1)))+'" placeholder="v2"></label>'+
      '<label class="full">工程证据与复测结论<textarea id="ev-note" minlength="20" maxlength="1800" required placeholder="测量点；现象；故障假设；修改动作；复测结果；证据文件名">'+esc(old.note||'')+'</textarea></label>'+
      '<label class="full">给教师的具体问题（可选）<textarea id="ev-question" maxlength="500" placeholder="我希望教师重点核对……">'+esc(old.question||'')+'</textarea></label>'+
      '</div><p class="help">请写实际测点和观察结果。工具不接受“已完成”“正常”等没有证据线索的单句作为闭环。</p>'+
      '<div class="form-actions"><button type="button" id="v3-ev-cancel">取消</button><button class="primary" type="submit">保存并提交本轮</button></div></form>');
    document.getElementById('v3-ev-cancel').onclick=()=>dialog.close();
    document.getElementById('v3-evidence-form').onsubmit=e=>{
      e.preventDefault();
      const note=document.getElementById('ev-note').value.trim();
      if(note.length<20||!/(测量|测点|波形|截图|读数|复测|修改|文件|Pin|U[1-6])/.test(note)){toast('请写清测点和可回查的证据线索');return}
      if(id===3&&(!tool||!tool.manualRunAt)){toast('请先打开测量诊断并点击运行检查');return}
      t.evidence={file:document.getElementById('ev-file').value.trim(),version:document.getElementById('ev-ver').value.trim(),note,question:document.getElementById('ev-question').value.trim(),savedAt:K.now(),tool:tool?{passed:tool.summary.passed,total:tool.summary.total,manualRunAt:tool.manualRunAt}:null};
      t.status='submitted';t.revision=(t.revision||0)+1;
      const next=C.stages.find(s=>s.id>id);
      if(next&&state.tasks[next.id].status==='locked')state.tasks[next.id].status='todo';
      K.save(state);dialog.close();renderArchive(gateInfo(readGate()));toast('阶段本轮已保存，等待教师审核');
    };
  }
  function openFeedbackImport(){
    openDialog('导入教师反馈包','<p>教师审核后将反馈包通过课程群发回。导入后会增加修订轮次，原证据保留。</p><textarea id="v3-fb-code" class="code" placeholder="EECLK3.……"></textarea><div class="form-actions"><button type="button" id="v3-fb-file">选择 JSON</button><button class="primary" id="v3-fb-apply">导入反馈</button></div>');
    document.getElementById('v3-fb-file').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const v=JSON.parse(await i.files[0].text());document.getElementById('v3-fb-code').value=v.code||JSON.stringify(v)}catch(e){toast('文件无法读取')}};i.click()};
    document.getElementById('v3-fb-apply').onclick=()=>{
      try{
        const v=document.getElementById('v3-fb-code').value.trim();
        const f=v.startsWith('EECLK3.')?K.decodeFeedback(v):JSON.parse(v);
        if(f.kind!=='feedback'||f.account!==state.account)throw Error('反馈包与当前小组不匹配');
        const t=state.tasks[f.stage];if(!t)throw Error('阶段不存在');
        t.feedback=t.feedback||[];t.feedback.push(f);
        t.status=f.decision==='通过'?'reviewed':'rework';
        if(f.decision!=='通过')t.revision=(t.revision||0)+1;
        K.save(state);dialog.close();renderArchive(gateInfo(readGate()));toast('教师反馈已导入');
      }catch(err){toast('反馈包无效：'+err.message)}
    };
  }

  /* ---------------- 教师端 ---------------- */
  function dimBars(a){
    if(!a||!a.dimensions)return '';
    return '<div class="v3-dims">'+a.dimensions.map(d=>{const cls=d.rate>=85?'high':d.rate>=65?'mid':'low';
      return '<div class="v3-dim"><span>'+esc(d.label)+'</span><i><b class="'+cls+'" style="width:'+d.rate+'%"></b></i><strong>'+d.score+'<small>/'+d.max+'</small></strong></div>'}).join('')+'</div>';
  }
  function avgScore(items){return items.length?Math.round(items.reduce((s,x)=>s+x.score,0)/items.length*10)/10:'—'}
  function renderTeacherReview(){
    const body=moduleHero('教师端 · 课后教师评阅','上传作业文件，形成可解释的辅助评分','教师选择一个 .ms14 或整个“课程文件”文件夹，系统按器件与关键引脚的实际连接情况给出 10 个维度的结构评分；最终成绩由教师结合实测、报告和答辩确定。','<button class="primary" id="v2-import-folder">选择课程文件夹</button>')+
      '<div class="v2-teacher-summary"><div><span>已读取作业</span><b>'+batch.length+'</b></div><div><span>平均结构分</span><b>'+avgScore(batch)+'</b></div><div><span>A/B 档</span><b>'+batch.filter(x=>x.score>=80).length+'</b></div><div><span>关键引脚悬空</span><b>'+batch.filter(x=>(x.counts?.openKeyPins||0)>0).length+'</b></div></div>'+
      '<section class="v2-review-card"><div class="v2-review-head"><div><h2>作业评阅清单</h2><p>点击文件名查看该作业的维度得分、关键引脚问题和建议。</p></div><div class="row"><button id="v2-import-single">选择单个 .ms14</button><button id="v2-clear-batch" class="danger">清空本机清单</button></div></div><div id="v2-batch-table">'+renderTeacherTable(batch)+'</div></section><div id="v2-review-detail"></div>';
    shell('review',body,gateInfo(freshGate()));
    document.getElementById('v2-import-folder').onclick=()=>chooseMs14(true);
    document.getElementById('v2-import-single').onclick=()=>chooseMs14(false);
    document.getElementById('v2-clear-batch').onclick=()=>{batch=[];store.remove('ee-ms14-batch-v1');renderTeacherReview();toast('已清空教师本机评阅清单')};
    document.querySelectorAll('[data-v2-analysis]').forEach(b=>b.onclick=()=>showTeacherDetail(batch[Number(b.dataset.v2Analysis)]));
  }
  function renderTeacherTable(items){
    if(!items.length)return '<div class="empty">尚未读取课程文件。选择整个文件夹后，系统会按文件逐份分析。</div>';
    return '<div class="table-wrap"><table class="v2-table"><thead><tr><th>作业文件</th><th>结构分</th><th>等级</th><th>器件</th><th>计数/显示</th><th>网络</th><th>主要问题</th></tr></thead><tbody>'+items.map((x,i)=>'<tr><td><button class="link" data-v2-analysis="'+i+'">'+esc(x.filename)+'</button></td><td><b class="v2-score-mini '+(x.score<70?'low':x.score<85?'mid':'high')+'">'+x.score+'</b></td><td><span class="v3-grade g'+esc(x.grade||'E')+'">'+esc(x.grade||'—')+'</span></td><td>'+x.componentCount+'</td><td>'+x.counts.counters+'/'+x.counts.displays+'</td><td>'+Math.round(x.connectionRate*100)+'%</td><td>'+esc(x.primaryIssue||x.suggestions?.[0]||x.questions?.[0]||'需补交波形证据')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function chooseMs14(folder){
    const input=document.createElement('input');input.type='file';input.accept='.ms14,application/octet-stream';
    if(folder){input.webkitdirectory=true;input.multiple=true}
    input.onchange=async()=>{
      const files=[...input.files].filter(f=>/\.ms14$/i.test(f.name));
      if(!files.length){toast('没有找到 .ms14 文件');return}
      if(!window.MS14Decoder||!window.CourseFileAnalyzer){toast('解析模块未加载，请刷新页面');return}
      const items=[];
      for(const file of files){try{const d=window.MS14Decoder.decode(await file.arrayBuffer());items.push(window.CourseFileAnalyzer.analyze(d.xml,file.name))}catch(error){toast(file.name+' 读取失败：'+error.message)}}
      batch=items;store.set('ee-ms14-batch-v1',JSON.stringify(items));renderTeacherReview();toast('已读取 '+items.length+' 份作业');
    };
    input.click();
  }
  function showTeacherDetail(a){
    if(!a)return;
    const box=document.getElementById('v2-review-detail');
    box.innerHTML='<section class="v2-review-detail"><div class="row between"><div><span class="v2-kicker">作业文件分析</span><h2>'+esc(a.filename)+'</h2></div><span class="v2-score-big '+(a.score<70?'low':a.score<85?'mid':'high')+'">'+a.score+'<small>/100</small></span></div>'+
      '<p>等级 <b class="v3-grade g'+esc(a.grade||'E')+'">'+esc(a.grade||'—')+'</b> · '+esc(a.level)+' · 组件 '+a.componentCount+' · 网络覆盖 '+Math.round(a.connectionRate*100)+'% · 端口连接率 '+Math.round((a.portRate||0)*100)+'%</p>'+
      (a.clockSource?.text?'<p class="muted">时钟源：'+esc(a.clockSource.text)+'</p>':'')+
      (a.fatal&&a.fatal.length?'<div class="v3-fatal"><b>致命连接缺陷 '+a.fatal.length+' 处</b><ul>'+a.fatal.map(x=>'<li>'+esc(x.ref)+'：'+esc(x.text)+'</li>').join('')+'</ul><small>这类缺陷会导致对应模块完全不工作，建议优先课堂追问。</small></div>':'')+
      '<h3>十维结构评分</h3>'+dimBars(a)+
      '<div class="grid equal"><div><h3>针对性问题</h3><ol>'+a.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ol></div><div><h3>建议动作</h3><ul>'+a.suggestions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul></div></div>'+
      '<div class="v2-review-actions"><button class="primary" id="v2-copy-feedback">复制本作业追问</button><button id="v2-close-detail">收起</button></div></section>';
    document.getElementById('v2-copy-feedback').onclick=async()=>{
      const text='作业：'+a.filename+'\n结构评分：'+a.score+'/100（等级 '+a.grade+'）\n维度：'+a.dimensions.map(d=>d.label+' '+d.score+'/'+d.max).join('；')+'\n教师追问：\n'+a.questions.join('\n')+'\n建议：\n'+a.suggestions.join('\n');
      try{await navigator.clipboard.writeText(text);toast('已复制教师追问')}catch(e){openDialog('复制内容','<textarea class="code" style="min-height:200px">'+esc(text)+'</textarea>')}
    };
    document.getElementById('v2-close-detail').onclick=()=>{box.innerHTML=''};
  }
  function renderOverview(){
    const body=moduleHero('教师端 · 班级概览','先看班级差异，再决定课堂干预','结构评分只用于安排追问。教师可以优先处理低分、关键引脚悬空或缺少调时去抖的作业。','<button class="primary" id="v2-overview-review">回到作业评阅</button>')+
      '<div class="v2-teacher-summary"><div><span>作业数量</span><b>'+batch.length+'</b></div><div><span>平均分</span><b>'+avgScore(batch)+'</b></div><div><span>最高分</span><b>'+(batch.length?Math.max(...batch.map(x=>x.score)):'—')+'</b></div><div><span>最低分</span><b>'+(batch.length?Math.min(...batch.map(x=>x.score)):'—')+'</b></div></div>'+
      '<section class="v2-review-card"><h2>按分数安排干预</h2><div class="v2-bars">'+batch.slice().sort((a,b)=>a.score-b.score).map(x=>'<div class="v2-bar-row"><span>'+esc(x.filename)+'</span><i><b style="width:'+x.score+'%"></b></i><strong>'+x.score+'</strong></div>').join('')+'</div></section>'+
      '<div class="v2-callout">建议课堂顺序：先处理有致命连接缺陷（INA 悬空、555 复位端未接、数码管输入悬空）的文件，再处理缺少调时去抖的作业，最后用波形和答辩确认结构完整的作业。</div>';
    shell('overview',body,gateInfo(freshGate()));
    document.getElementById('v2-overview-review').onclick=()=>{page='review';renderTeacherReview()};
  }
  function renderResources(){
    const body=moduleHero('教师端 · 课程资源','知识卡、实验章节和工程问题一一对应','教师可用知识卡统一追问口径；学生的 .ms14 结构分析只作为入口，最终结论仍需回到实验手册和实测证据。','<button class="primary" id="v2-resources-tool">打开诊断工具</button>')+
      '<div class="v2-section-title">课程知识图谱</div><section class="kg-root"><div id="kg-mount-resources"></div></section>'+
      '<div class="v2-section-title">课中知识卡</div><div class="v2-grid3">'+C.cards.map(c=>'<article class="v2-card"><span class="v2-kicker">'+c.id+'</span><h3>'+esc(c.title)+'</h3><p>'+esc((KB.cards[c.id]||{}).principle||c.focus)+'</p><div class="v2-evidence-box"><b>复测要求</b><p>'+esc(c.evidence)+'</p></div><small>回看：'+esc(c.source)+'</small></article>').join('')+'</div>'+
      '<div class="v2-section-title">课前预习卡</div><div class="v2-grid3">'+PREP.map(c=>'<article class="v2-card"><span class="v2-kicker">预习 · '+c.minutes+' 分钟</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.summary)+'</p></article>').join('')+'</div>';
    shell('resources',body,gateInfo(freshGate()));
    mountGraph('kg-mount-resources');
    document.getElementById('v2-resources-tool').onclick=()=>{location.href='engineering-design-tool.html?role=teacher'};
  }
  function start(){if(role==='student')render();else renderTeacherReview()}
  if(role==='student'&&!state){render()}else start();
})();
