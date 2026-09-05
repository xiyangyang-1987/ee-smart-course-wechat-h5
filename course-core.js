(function(){
  'use strict';
  const C=window.CLOCK_COURSE;
  const STORE='ee-smart-course-v3:';
  const TOOL='ee-digital-clock-tool-v3:';
  const now=()=>new Date().toISOString();
  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const b64Encode=o=>{const bytes=new TextEncoder().encode(JSON.stringify(o));let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return 'EECLK3.'+btoa(s)};
  const b64Decode=s=>{if(!String(s).trim().startsWith('EECLK3.'))throw Error('提交码前缀不正确');const bin=atob(String(s).trim().slice(7));return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0))))};
  const freshTasks=()=>Object.fromEntries(C.stages.map((x,i)=>[x.id,{status:i===0?'todo':'locked',revision:0,feedback:[]}]));
  const fresh=(account)=>({version:3,account,createdAt:now(),updatedAt:now(),tasks:freshTasks(),tool:null,imports:[],studentNote:''});
  function load(account){try{const v=JSON.parse(localStorage.getItem(STORE+account)||'null');if(v&&v.version===3)return Object.assign(fresh(account),v,{account});}catch(e){}return fresh(account)}
  function save(s){s.updatedAt=now();localStorage.setItem(STORE+s.account,JSON.stringify(s));return s}
  function readTool(account){try{const v=JSON.parse(localStorage.getItem(TOOL+account)||'null');return v&&v.version===3?v:null}catch(e){return null}}
  function writeTool(account,v){localStorage.setItem(TOOL+account,JSON.stringify(v));return v}
  function isDone(t){return ['submitted','reviewed'].includes(t?.status)}
  function doneCount(s){return Object.values(s.tasks).filter(isDone).length}
  function nextOpen(s){return C.stages.find(x=>s.tasks[x.id].status==='todo'||s.tasks[x.id].status==='rework')?.id||6}
  function taskStatusText(t){return {todo:'待完成',locked:'未解锁',submitted:'待教师审核',reviewed:'已审核',rework:'需修改'}[t?.status]||'待完成'}
  function expectedChecks(input){
    const p=input?.params||{}, m=input?.measurements||{};
    const hz=Number(m.frequency), freq=Number.isFinite(hz)&&hz>=.95&&hz<=1.05&&String(m.frequencyPoint||'').trim().length>=3;
    const carry=/59/.test(String(m.carry||''))&&/00/.test(String(m.carry||''))&&/(测点|Pin|QC|波形|截图|读数)/i.test(String(m.carry||''));
    const bcd=/(QA|QB|QC|QD)/i.test(String(m.bcd||''))&&/(A|B|C|D)/.test(String(m.bcd||''))&&String(m.bcd||'').trim().length>=12;
    const reset=(String(p.mode)==='12'?/11:59:59/.test(String(m.reset||''))&&/12:00:00|01:00:00/.test(String(m.reset||'')):/23:59:59/.test(String(m.reset||''))&&/00:00:00/.test(String(m.reset||'')))&&/(测点|Pin|QB|QC|R0|波形|截图)/i.test(String(m.reset||''));
    const adjust=p.adjust==='no'||(/按键|脉冲|去抖|7414|7432/.test(String(m.adjust||''))&&String(m.adjust||'').trim().length>=12);
    const evidence=String(input?.evidence||'').trim().length>=20&&/(波形|截图|读数|测点|文件|复测|版本)/.test(String(input?.evidence||''));
    return [{id:'frequency',ok:freq,detail:freq?'实测频率与测点已填写':'需要填写实测 Hz 和仪器/测点'},{id:'carry',ok:carry,detail:carry?'59→00 进位线索可复核':'需要写59、00及QC/波形等测点线索'},{id:'bcd',ok:bcd,detail:bcd?'BCD位序记录已填写':'需要写QA/QB/QC/QD与A/B/C/D对应关系'},{id:'reset',ok:reset,detail:reset?'边界回零与测点线索已填写':'需要填写与时制匹配的边界和复位测点'},{id:'adjust',ok:adjust,detail:adjust?'调时/按键条件已记录':'需要记录按键去抖/脉冲，或明确本方案不含调时'},{id:'evidence',ok:evidence,detail:evidence?'结论包含可回查证据线索':'需要写足够的波形、读数、文件或复测证据'}]
  }
  function runTool(account,input){
    const checks=expectedChecks(input), passed=checks.filter(x=>x.ok).length;
    const out={version:3,account,params:clone(input.params),measurements:clone(input.measurements),evidence:String(input.evidence||''),checks,summary:{passed,total:checks.length},manualRunAt:now(),savedAt:now()};
    writeTool(account,out);return out
  }
  function validateTool(t){
    if(!t||t.version!==3||!t.params||!t.measurements||!t.manualRunAt)throw Error('缺少真实运行记录');
    const exp=expectedChecks(t), passed=exp.filter(x=>x.ok).length;
    if(!Array.isArray(t.checks)||t.checks.length!==6||Number(t.summary?.passed)!==passed)throw Error('检查摘要与测量记录不一致');
    return t
  }
  function buildReport(s){
    return {tool:'EE-SmartCourse-Classroom-v3',version:3,account:s.account,exportedAt:now(),privacy:'本地浏览器保存，不含姓名学号和上传文件',completedStages:doneCount(s),tasks:C.stages.map(st=>({id:st.id,title:st.title,status:s.tasks[st.id].status,revision:s.tasks[st.id].revision,evidence:s.tasks[st.id].evidence||null,feedback:s.tasks[st.id].feedback||[]})),toolCheck:s.tool||readTool(s.account),studentNote:s.studentNote||''}
  }
  function normalizeReport(r){
    if(!r||r.tool!=='EE-SmartCourse-Classroom-v3'||!Array.isArray(r.tasks)||r.tasks.length!==6)throw Error('不是第3版课程档案');
    const ids=new Set(r.tasks.map(x=>Number(x.id)));if(ids.size!==6)throw Error('阶段记录不完整');
    const tool=r.toolCheck?validateTool(r.toolCheck):null;
    return {account:String(r.account||'').trim().slice(0,32),completedStages:Number(r.completedStages)||0,tasks:r.tasks,toolCheck:tool,studentNote:String(r.studentNote||'').slice(0,1000),exportedAt:r.exportedAt||now()}
  }
  function feedbackCode(account,stage,body,reviewer,decision){
    return b64Encode({kind:'feedback',account,stage:Number(stage),body:String(body).slice(0,1000),reviewer:String(reviewer||'教师').slice(0,40),decision:['通过','修改后复审','补充证据'].includes(decision)?decision:'修改后复审',createdAt:now()})
  }
  function decodeFeedback(code){const v=b64Decode(code);if(v.kind!=='feedback'||!v.account||!v.stage||!v.body)throw Error('反馈包字段不完整');return v}
  window.COURSE_CORE={C,STORE,TOOL,esc,clone,fresh,load,save,readTool,writeTool,isDone,doneCount,nextOpen,taskStatusText,expectedChecks,runTool,validateTool,buildReport,normalizeReport,b64Encode,b64Decode,feedbackCode,decodeFeedback,now};
})();
