/* 课程文件分析器：只在浏览器内解析 .ms14，保存结构摘要，不保存原始电路文件。
   评分口径 v3：8 个连续维度（满分 100），按器件关键引脚的实际连接情况计分，
   不再把 74LS08/7432 中未使用的冗余门端口当作缺陷，因此结构不同的作业会得到不同分数。 */
(function(){
  'use strict';
  const clean=value=>String(value||'').replace(/&amp;/g,'&').replace(/^&ASC/,'').trim();
  const valuesOf=node=>{const a=[...node.querySelectorAll('CiaCollString Item[Value]')].map(x=>clean(x.getAttribute('Value')));const b=[...node.querySelectorAll('CiaCString[String]')].map(x=>clean(x.getAttribute('String')));return [...new Set([...a,...b].filter(Boolean))]};
  const matches=(values,re)=>values.some(value=>re.test(value));
  const labelOf=values=>values.find(value=>/74LS\d+|DCD_HEX|HEX_DISPLAY|LM?555|CLOCK_VOLTAGE|DIGITAL_CLOCK|7408|7432|7414|SWITCH|BUTTON|SCOPE|PROBE|RESISTOR|CAPACITOR|POTENTIOMETER|VCC|GROUND/i.test(value))||values[0]||'未知器件';
  const refs=items=>items.slice(0,8).map(x=>x.ref).join('、');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ratio=(a,b)=>b>0?clamp(a/b,0,1):0;
  const fix1=v=>Math.round(v*10)/10;

  /* 关键引脚：只有这些引脚才进入“悬空治理”判断，冗余逻辑门不再扣分。 */
  const TIMER_PINS=['OUT','TRI','THR','CON','RST','DIS'];
  const COUNTER_PINS=['INA','INB','R01','R02','R91','R92','QA','QB','QC','QD'];
  const DISPLAY_PINS=['1','2','3','4'];
  const FATAL_RULES=[
    {re:/74LS90|74LS160|74LS390|DECADE COUNTER/i,pins:['INA','INB'],text:'计数器时钟输入悬空'},
    {re:/LM?555|555 TIMER/i,pins:['OUT'],text:'555 输出端悬空'},
    {re:/LM?555|555 TIMER/i,pins:['RST'],text:'555 复位端(Pin4)未接 VCC'},
    {re:/DCD_HEX|HEX_DISPLAY|74LS48/i,pins:['1','2','3','4'],text:'数码管 BCD 输入悬空'}
  ];

  const isTimer=values=>matches(values,/LM?555|555 TIMER/i);
  const isCounter=values=>matches(values,/74LS90|74LS160|74LS390|DECADE COUNTER/i);
  const isDisplay=values=>matches(values,/DCD_HEX|74LS48|HEX_DISPLAY|7.?SEG/i);
  const isAndChip=values=>matches(values,/74LS08|7408|AND08|2.?INPUT AND/i);
  const isOrChip=values=>matches(values,/74LS32|7432|2.?INPUT OR/i);
  const isDebounce=values=>matches(values,/7414|SCHMITT|PB_NO|PUSH|BUTTON|SUPPLEMENTARY_SWITCHES/i);
  const isInstrument=values=>matches(values,/SCOPE|XSC|LOGIC.?ANALYZER|MULTIMETER|FREQUENCY_COUNTER|PROBE|INDICATOR|LED/i);
  const isPower=values=>matches(values,/VCC|GROUND|GND|POWER_SOURCES/i);

  function analyze(xml,filename){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('MS14 内部 XML 无法解析');
    const portMap=new Map([...doc.querySelectorAll('CiPort')].map(node=>[node.parentElement?.getAttribute('CiID')||'',{name:clean(node.getAttribute('LocalName')),live:[...node.querySelectorAll(':scope > Nodes > Item[CiID]')].length>0}]));
    const components=[...doc.querySelectorAll('CiComponent')].map(node=>{
      const values=valuesOf(node);
      const ports=[...node.querySelectorAll(':scope > Ports > Item[CiID]')].map(x=>{const p=portMap.get(x.getAttribute('CiID'))||{name:'',live:false};return {name:p.name,live:p.live}});
      const connectedPorts=ports.filter(p=>p.live).length;
      return {ref:clean(node.getAttribute('LocalName')),model:node.getAttribute('Model')||'',values,label:labelOf(values),ports,connectedPorts,totalPorts:ports.length,connected:connectedPorts>0};
    });

    const componentCount=components.length;
    const connectedCount=components.filter(x=>x.connected).length;
    const connectionRate=componentCount?connectedCount/componentCount:0;
    const totalPorts=components.reduce((s,x)=>s+x.totalPorts,0);
    const connectedPorts=components.reduce((s,x)=>s+x.connectedPorts,0);
    const portRate=totalPorts?connectedPorts/totalPorts:0;

    const counters=components.filter(x=>isCounter(x.values));
    const displays=components.filter(x=>isDisplay(x.values));
    const timers=components.filter(x=>isTimer(x.values));
    const andChips=components.filter(x=>isAndChip(x.values));
    const orChips=components.filter(x=>isOrChip(x.values));
    const debounces=components.filter(x=>isDebounce(x.values));
    const instruments=components.filter(x=>isInstrument(x.values));
    const powers=components.filter(x=>isPower(x.values));

    /* 有效逻辑门：只统计“输出端已经接入网络”的门，未使用的冗余门不算缺口。 */
    const gateCount=(chips)=>chips.reduce((sum,x)=>sum+x.ports.filter(p=>/^[1-4]Y$/i.test(p.name)&&p.live).length,0);
    const usedAndGates=gateCount(andChips),usedOrGates=gateCount(orChips);

    const pinRate=(chips,pins)=>{const all=chips.flatMap(c=>c.ports.filter(p=>pins.includes(p.name)));return all.length?all.filter(p=>p.live).length/all.length:0};
    const timerPinRate=pinRate(timers,TIMER_PINS);
    const counterPinRate=pinRate(counters,COUNTER_PINS);
    const displayPinRate=pinRate(displays,DISPLAY_PINS);

    /* 关键引脚悬空明细 + 致命连接缺陷（时钟输入、555 输出/复位端、数码管 BCD 输入） */
    const pinGaps=[];
    const collectGaps=(chips,pins,type)=>chips.forEach(c=>{const open=c.ports.filter(p=>pins.includes(p.name)&&!p.live).map(p=>p.name);if(open.length)pinGaps.push({ref:c.ref,type,pins:open})});
    collectGaps(counters,COUNTER_PINS,'74LS90');
    collectGaps(timers,TIMER_PINS,'555');
    collectGaps(displays,DISPLAY_PINS,'DCD_HEX');
    const openKeyPins=pinGaps.reduce((s,g)=>s+g.pins.length,0);
    const fatal=[];
    FATAL_RULES.forEach(rule=>components.forEach(c=>{if(!rule.re.test(c.values.join(' ')))return;const open=c.ports.filter(p=>rule.pins.includes(p.name)&&!p.live).map(p=>p.name);if(open.length)fatal.push({ref:c.ref,text:rule.text+'（'+open.join('、')+'）'})}));


    /* 时钟源规范：手册附录 7.3 推荐 DIGITAL_CLOCK / PULSE_VOLTAGE，不推荐理想方波 CLOCK_VOLTAGE。 */
    const allValues=components.flatMap(x=>x.values);
    const recommendedClock=matches(allValues,/DIGITAL_CLOCK|PULSE_VOLTAGE/i);
    const idealClockOnly=!recommendedClock&&matches(allValues,/CLOCK_VOLTAGE/i);
    const clockSourceScore=recommendedClock?1:idealClockOnly?.45:.7;
    const clockSourceText=recommendedClock?'使用 DIGITAL_CLOCK / PULSE_VOLTAGE（手册推荐）':idealClockOnly?'仅识别到 CLOCK_VOLTAGE 理想方波源（手册不推荐，易跳数）':timers.length?'未识别到独立时钟源，需说明秒脉冲来源':false;

    /* 器件编号规范：手册要求 U1~U6 依次对应秒个位~时十位。 */
    const numbered=components.filter(x=>/^U\d+$/.test(x.ref)).length;
    const numberingRate=componentCount?numbered/componentCount:0;
    const manualIds=new Set(counters.map(x=>x.ref).concat(displays.map(x=>x.ref)));
    const numberingOk=['U1','U2','U3','U4','U5','U6'].filter(id=>manualIds.has(id)).length;

    /* ---------- 10 个连续维度：每个规范性指标独立计分，扣分位置不同则分数不同 ---------- */
    const dims=[
      {key:'timebase',label:'时基器件与时钟源',max:12,score:6*(timers.length?1:0)+6*clockSourceScore},
      {key:'timerpin',label:'555 引脚规范性',max:5,score:5*timerPinRate},
      {key:'counter',label:'计数链完整度',max:12,score:12*ratio(counters.length,6)},
      {key:'counterpin',label:'计数器引脚规范性',max:6,score:6*counterPinRate},
      {key:'display',label:'显示与译码链',max:9,score:9*ratio(displays.length,6)},
      {key:'displaypin',label:'数码管输入规范性',max:4,score:4*displayPinRate},
      {key:'pinorder',label:'关键引脚治理',max:12,score:(counters.length||timers.length||displays.length)?12*clamp(1-openKeyPins/5,0,1):0},
      {key:'reset',label:'进位与回零逻辑',max:12,score:12*(.75*ratio(usedAndGates,3)+.25*ratio(usedOrGates,2))},
      {key:'adjust',label:'调时与去抖',max:10,score:10*ratio(debounces.length,4)},
      {key:'connect',label:'网络与端口连接质量',max:18,score:18*(.45*connectionRate+.55*portRate)}
    ];
    dims.forEach(d=>{d.score=fix1(clamp(d.score,0,d.max));d.rate=fix1(d.score/d.max*100)});
    const score=fix1(clamp(dims.reduce((s,d)=>s+d.score,0),0,100));
    const evidenceGap=fatal.length?fatal.map(x=>x.ref+' '+x.text).join('；'):'';
    const grade=score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'E';
    const level={A:'结构完整，可进入证据核验',B:'结构较完整，需补少数模块',C:'结构基本完整，存在明显缺口',D:'结构缺口较多，需先补模块',E:'结构不完整，建议重新梳理方案'}[grade];

    const checks=[
      {key:'clock',label:'时基来源',ok:timers.length>0,detail:timers.length?'识别 '+timers.length+' 个 555/时基器件：'+refs(timers):'未识别 555 或 DIGITAL_CLOCK 时基'},
      {key:'counter',label:'计数链',ok:counters.length>=4&&counterPinRate>=.98,detail:'识别 '+counters.length+' 片计数器：'+refs(counters)+'；关键引脚连接率 '+Math.round(counterPinRate*100)+'%'},
      {key:'display',label:'显示链',ok:displays.length>=4&&displayPinRate>=.98,detail:'识别 '+displays.length+' 个显示/译码器件：'+refs(displays)+'；BCD 输入连接率 '+Math.round(displayPinRate*100)+'%'},
      {key:'reset',label:'边界回零',ok:usedAndGates>=2,detail:usedAndGates?'接入网络的与门 '+usedAndGates+' 个：'+refs(andChips)+'，需结合 60/24 边界波形核对':'未识别到已接入网络的与门回零逻辑'},
      {key:'debounce',label:'调时与去抖',ok:debounces.length>=2&&usedOrGates>=1,detail:debounces.length||usedOrGates?'去抖器件 '+debounces.length+' 个、有效或门 '+usedOrGates+' 个':'未识别 7414 去抖或 7432 调时或门，若方案不含调时需在报告说明'},
      {key:'connectivity',label:'网络连接覆盖',ok:connectionRate>=.8,detail:connectedCount+'/'+componentCount+' 个器件接入网络（'+Math.round(connectionRate*100)+'%），端口连接率 '+Math.round(portRate*100)+'%'},
      {key:'pinorder',label:'关键引脚治理',ok:openKeyPins===0,detail:openKeyPins?openKeyPins+' 个关键引脚悬空：'+pinGaps.map(g=>g.ref+' '+g.pins.join('/')).join('、'):'关键器件（计数器、555、数码管）的引脚均已接入网络'},
      {key:'numbering',label:'器件编号规范',ok:numberingOk>=6,detail:numberingOk?('已按手册使用 U1~U6 中的 '+numberingOk+' 个编号'):'建议按手册把秒个位~时十位统一编号为 U1~U6'}
    ];

    const suggestions=[],questions=[];
    if(!timers.length){suggestions.push('文件中未识别到 555 时基；补充 555 或 DIGITAL_CLOCK，并用示波器记录 1 Hz 实测点。');questions.push('这份电路的秒脉冲来自哪里？请指出时钟源和计数器输入端。')}
    else{
      const open=timers.flatMap(c=>c.ports.filter(p=>TIMER_PINS.includes(p.name)&&!p.live).map(p=>c.ref+'.'+p.name));
      if(open.length){suggestions.push('555 存在未连接的关键引脚：'+open.join('、')+'。手册明确要求 Pin4(RST) 接 VCC、Pin3(OUT) 输出到计数器，否则不振荡或没有秒脉冲。');questions.push('555 的 '+open.join('、')+' 为什么没有接入网络？请给出该引脚的应有电平和测量点。')}
      else questions.push('555 关键引脚连接完整；请展示 Pin3 的实测频率和输入边沿波形。');
      if(idealClockOnly){suggestions.push('检测到 CLOCK_VOLTAGE 理想方波源。手册附录 7.3 指出其上升/下降时间为零，会产生毛刺导致计数器跳数，建议改用 DIGITAL_CLOCK 或 PULSE_VOLTAGE（TR=TF=5 ns）。');questions.push('你使用的时钟源是哪一种？如果出现跳数，如何用时基源设置解释并排除？')}
    }
    if(counters.length<6){suggestions.push('只识别到 '+counters.length+' 片计数器（'+(refs(counters)||'无')+'）；说明当前文件是局部电路还是完整时、分、秒级联。');questions.push('当前文件中 '+(refs(counters)||'计数器')+' 分别承担什么位？59→00 的进位从哪个引脚进入下一级？')}
    else{
      const open=counterPinsOpen(counters);
      if(open.length){suggestions.push('计数器存在悬空关键引脚：'+open.join('、')+'。R0/R9 必须明确接 GND，INA 必须接入时钟，否则该片不走数或停在某一位。');questions.push('请说明 '+open.join('、')+' 当前的电平来源；悬空输入在 Multisim 中可能被当作高电平。')}
      else questions.push('6 片计数器的时钟、复位与 BCD 输出均已接入网络；请逐一说明秒、分、时的分工和级联关系。');
    }
    if(displays.length<6){suggestions.push('只识别到 '+displays.length+' 个显示/译码器件（'+(refs(displays)||'无')+'）；补齐显示链或说明缺失位。');questions.push('为什么当前文件只有 '+displays.length+' 个显示/译码器件？显示位是否与 6 位时钟要求一致？')}
    else questions.push('6 位数码管均已接入；请用 0—9 固定输入证明 QA/QB/QC/QD 与 D—C—B—A 位序正确。');
    if(usedAndGates<2){suggestions.push('只识别到 '+usedAndGates+' 个已接入网络的与门；补充 60/24 进制回零逻辑，并保存 59→00、23→00 边界证据。');questions.push('文件中与门回零线索不足，23:59:59 如何变为 00:00:00？请指出 QB、QC、7408 和 R0。')}
    else questions.push('识别到 '+usedAndGates+' 个已接入的与门（'+refs(andChips)+'）；请说明哪些门负责秒、分、时回零，不能只凭器件存在判断有效。');
    if(debounces.length<2||!usedOrGates){suggestions.push('调时链路不完整：去抖器件 '+debounces.length+' 个、有效或门 '+usedOrGates+' 个。若包含调时，请补充 7414、RC 和 7432 合并点，并提交一次按键对应一次计数边沿的证据。');questions.push('一次按键如何保证只产生一个有效边沿？7432 的两个输入分别来自哪里？')}
    else questions.push('识别到 '+debounces.length+' 个去抖/按键器件（'+refs(debounces)+'）；请提交去抖前后波形和一次按键的计数响应。');
    if(openKeyPins){suggestions.push('关键器件存在悬空引脚，请逐个核对时钟、复位、译码使能脚，并区分“预留器件”和“误断线”。')}
    if(connectionRate<.98)suggestions.push('网络覆盖率为 '+Math.round(connectionRate*100)+'%，先处理端口缺口，再进行功能判断。');
    if(!numberingOk)suggestions.push('器件编号与手册不一致（手册要求 U1~U6 依次为秒个位、秒十位、分个位、分十位、时个位、时十位）。统一编号可以让学生和教师在同一条证据线上沟通。');
    if(!suggestions.length)suggestions.push('文件结构与接线规范均已达标。下一步提交 1 Hz、59→00、23→00 三组波形，并把结构分析结果与 Multisim 实测结论逐项对应。');
    function counterPinsOpen(chips){return chips.flatMap(c=>c.ports.filter(p=>['INA','INB','R01','R02','R91','R92'].includes(p.name)&&!p.live).map(p=>c.ref+'.'+p.name))}

    return {
      version:3,filename,format:'Multisim .ms14 压缩 XML',parsedAt:new Date().toISOString(),
      score,grade,level,dimensions:dims,fatal,evidenceGap,openKeyPins,
      clockSource:{recommended:recommendedClock,idealOnly:idealClockOnly,text:clockSourceText},
      primaryIssue:suggestions[0]||questions[0]||'提交边界波形供教师复核',
      componentCount,connectedCount,connectionRate,portRate,
      counts:{clocks:timers.length,counters:counters.length,displays:displays.length,andGates:andChips.length,usedAndGates,orGates:orChips.length,usedOrGates,debounce:debounces.length,instruments:instruments.length,power:powers.length,criticalUnconnected:components.filter(x=>!x.connected&&!isInstrument(x.values)).length,criticalPartial:pinGaps.length,openKeyPins,fatalFaults:fatal.length,numberingOk},
      pinGaps,checks,suggestions,questions,
      components:components.slice(0,100).map(x=>({ref:x.ref,model:x.model,label:x.label,values:x.values.slice(0,12),connected:x.connected,connectedPorts:x.connectedPorts,totalPorts:x.totalPorts}))
    };
  }
  window.CourseFileAnalyzer={analyze};
})();
