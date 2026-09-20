/* 课程文件分析器：只在浏览器内解析 .ms14，保存结构摘要，不保存原始电路文件。 */
(function(){
  'use strict';
  const clean=value=>String(value||'').replace(/&amp;/g,'&').replace(/^&ASC/,'').trim();
  const valuesOf=node=>{const a=[...node.querySelectorAll('CiaCollString Item[Value]')].map(x=>clean(x.getAttribute('Value')));const b=[...node.querySelectorAll('CiaCString[String]')].map(x=>clean(x.getAttribute('String')));return [...new Set([...a,...b].filter(Boolean))]};
  const matches=(values,re)=>values.some(value=>re.test(value));
  const labelOf=values=>values.find(value=>/74LS\d+|DCD_HEX|HEX_DISPLAY|LM?555|CLOCK_VOLTAGE|DIGITAL_CLOCK|7408|7432|7414|SWITCH|BUTTON|SCOPE|RESISTOR|CAPACITOR/i.test(value))||values[0]||'未知器件';
  const refs=items=>items.slice(0,8).map(x=>x.ref).join('、');
  function analyze(xml,filename){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('MS14 内部 XML 无法解析');
    const components=[...doc.querySelectorAll('CiComponent')].map(node=>{const values=valuesOf(node);const ports=[...node.querySelectorAll(':scope > Ports > Item[CiID]')].map(x=>x.getAttribute('CiID'));return {ref:clean(node.getAttribute('LocalName')),model:node.getAttribute('Model')||'',values,label:labelOf(values),ports}});
    const portMap=new Map([...doc.querySelectorAll('CiPort')].map(node=>[node.parentElement?.getAttribute('CiID')||node.getAttribute('id')||node.getAttribute('CiID')||'',{name:clean(node.getAttribute('LocalName')),nodes:[...node.querySelectorAll(':scope > Nodes > Item[CiID]')].map(x=>x.getAttribute('CiID'))}]));
    const componentStatus=components.map(component=>({...component,connected:component.ports.some(id=>(portMap.get(id)?.nodes||[]).length>0),connectedPorts:component.ports.filter(id=>(portMap.get(id)?.nodes||[]).length>0).length}));
    const connectedCount=componentStatus.filter(x=>x.connected).length,componentCount=components.length,connectionRate=componentCount?connectedCount/componentCount:0;
    const scopeRe=/scope|probe|measurement|XSC/i;
    const criticalUnconnected=componentStatus.filter(x=>!x.connected&&!scopeRe.test(x.label));
    const criticalPartial=componentStatus.filter(x=>x.connectedPorts>0&&x.connectedPorts<x.ports.length&&!scopeRe.test(x.label)&&!/(RESISTOR|CAPACITOR|POTENTIOMETER)/i.test(x.label));
    const counters=components.filter(x=>matches(x.values,/74LS90|74LS160|74LS390|DECADE COUNTER/i));
    const displays=components.filter(x=>matches(x.values,/DCD_HEX|74LS48|HEX_DISPLAY|7.?SEG/i));
    const clocks=components.filter(x=>matches(x.values,/LM?555|555 TIMER|CLOCK_SOURCE|CLOCK_VOLTAGE|DIGITAL_CLOCK|TIMER/i));
    const andGates=components.filter(x=>matches(x.values,/74LS08|7408|2.?INPUT AND|AND08/i));
    const orGates=components.filter(x=>matches(x.values,/74LS32|7432|2.?INPUT OR/i));
    const debounce=components.filter(x=>matches(x.values,/7414|SCHMITT|BUTTON|SWITCH|SUPPLEMENTARY_SWITCHES/i));
    const power=components.filter(x=>matches(x.values,/VCC|GROUND|GND|POWER_SOURCES/i));
    const checks=[
      {key:'clock',label:'时基来源',ok:clocks.length>0,detail:clocks.length?'识别 '+clocks.length+' 个时基/时钟相关器件：'+refs(clocks):'未识别 555 或 DIGITAL_CLOCK 时基'},
      {key:'counter',label:'计数链',ok:counters.length>=4,detail:'识别 '+counters.length+' 个计数器：'+refs(counters)+'；主线通常需要秒、分、时级联'},
      {key:'display',label:'显示链',ok:displays.length>=4,detail:'识别 '+displays.length+' 个显示/译码器件：'+refs(displays)},
      {key:'reset',label:'边界回零',ok:andGates.length>=2,detail:andGates.length?'识别 '+andGates.length+' 个与门：'+refs(andGates)+'，需结合60/24边界波形核对':'未识别足够的与门回零逻辑，需检查60/24进制边界'},
      {key:'debounce',label:'调时与去抖',ok:debounce.length>=2,detail:debounce.length?'识别 '+debounce.length+' 个按键/去抖器件：'+refs(debounce):'未识别7414、按键或补充开关，若方案不含调时需在报告说明'},
      {key:'connectivity',label:'网络连接覆盖',ok:connectionRate>=0.8,detail:connectedCount+'/'+componentCount+'个器件至少连接到网络节点（'+Math.round(connectionRate*100)+'%）'},
      {key:'unconnected',label:'悬空器件',ok:criticalUnconnected.length===0,detail:criticalUnconnected.length?'发现'+criticalUnconnected.length+'个非测量器件没有接入网络：'+refs(criticalUnconnected):'未发现非测量器件完全悬空'},
      {key:'partial',label:'关键端口',ok:criticalPartial.length<=2,detail:criticalPartial.length?'发现'+criticalPartial.length+'个关键器件存在未连接端口：'+criticalPartial.slice(0,6).map(x=>x.ref+' '+x.connectedPorts+'/'+x.ports.length).join('、'):'关键器件端口连接覆盖较完整'}
    ];
    const points={clock:15,counter:21,display:15,reset:12,debounce:10,connectivity:15,unconnected:4,partial:8};
    let score=checks.reduce((sum,x)=>sum+(x.ok?points[x.key]:0),0);
    score+=Math.min(2,Math.max(0,clocks.length-1))+Math.min(3,orGates.length)-Math.min(8,criticalPartial.length*2)-Math.min(6,criticalUnconnected.length*3);
    score=Math.max(0,Math.min(100,Math.round(score)));
    const suggestions=[],questions=[];
    if(!clocks.length){suggestions.push('文件中未识别到时基来源；补充555或DIGITAL_CLOCK，并用示波器记录1 Hz实测点。');questions.push('这份电路的秒脉冲来自哪里？请指出时钟源和计数器输入端。')}else questions.push('文件识别到'+clocks.length+'个时基相关器件（'+refs(clocks)+'），请展示实际频率和输入边沿波形。');
    if(counters.length<6){suggestions.push('只识别到'+counters.length+'个计数器（'+refs(counters)+'）；说明当前文件是局部电路还是完整时、分、秒级联。');questions.push('当前文件中'+(refs(counters)||'计数器')+'分别承担什么位？59→00的进位从哪个引脚进入下一级？')}else questions.push('文件识别到6片计数器（'+refs(counters)+'）；请逐一说明秒、分、时的分工和级联关系。');
    if(displays.length<6){suggestions.push('只识别到'+displays.length+'个显示/译码器件（'+refs(displays)+'）；补齐显示链或说明缺失位。');questions.push('为什么当前文件只有'+displays.length+'个显示/译码器件？显示位是否与6位时钟要求一致？')}else questions.push('文件识别到6个显示/译码器件（'+refs(displays)+'）；请用0—9固定输入证明QA/QB/QC/QD位序正确。');
    if(andGates.length<2){suggestions.push('只识别到'+andGates.length+'个与门回零线索；补充60/24进制回零逻辑，并保存59→00、23→00边界证据。');questions.push('文件中与门回零线索不足，23:59:59如何变为00:00:00？请指出QB、QC、7408和R0。')}else questions.push('识别到'+andGates.length+'个与门（'+refs(andGates)+'）；请说明哪些门负责秒、分、时回零，不能只凭器件存在判断有效。');
    if(debounce.length<2){suggestions.push('文件中只识别到'+debounce.length+'个去抖/按键相关器件；若包含调时，请补充7414、RC和单次脉冲证据。');questions.push('文件中去抖器件不足，是否包含调时功能？一次按键如何保证只产生一个有效边沿？')}else questions.push('识别到'+debounce.length+'个去抖/按键器件（'+refs(debounce)+'）；请提交去抖前后波形和一次按键的计数响应。');
    if(criticalUnconnected.length){suggestions.push('发现未接入网络的器件：'+refs(criticalUnconnected)+'。请区分预留器件与误断线，并检查电源、地线和控制脚。');questions.push(refs(criticalUnconnected)+'为什么没有接入网络？它们是预留器件，还是尚未完成连接？')}
    if(criticalPartial.length){suggestions.push('关键器件存在未连接端口：'+criticalPartial.slice(0,5).map(x=>x.ref+' '+x.connectedPorts+'/'+x.ports.length).join('、')+'。请逐个核对时钟、复位、译码和使能脚。');questions.push('哪些关键引脚没有连接？请对照'+criticalPartial.slice(0,4).map(x=>x.ref).join('、')+'的端口表补充测点和连接说明。')}
    if(connectionRate<0.98)suggestions.push('网络覆盖率为'+Math.round(connectionRate*100)+'%，先处理端口缺口，再进行功能判断。');
    if(!suggestions.length)suggestions.push('文件结构要素齐全。下一步提交1 Hz、59→00、23→00三组波形，并把结构分析结果与Multisim实测结论逐项对应。');
    return {version:2,filename,format:'Multisim .ms14 压缩 XML',parsedAt:new Date().toISOString(),score,level:score>=90?'结构完整':score>=75?'结构基本完整但需补证据':score>=60?'存在明显结构缺口':'需要先完善结构',componentCount,connectedCount,connectionRate,counts:{clocks:clocks.length,counters:counters.length,displays:displays.length,andGates:andGates.length,orGates:orGates.length,debounce:debounce.length,power:power.length,criticalUnconnected:criticalUnconnected.length,criticalPartial:criticalPartial.length},checks,suggestions,questions,components:componentStatus.slice(0,100).map(x=>({ref:x.ref,model:x.model,label:x.label,values:x.values.slice(0,12),connected:x.connected,connectedPorts:x.connectedPorts,totalPorts:x.ports.length}))};
  }
  window.CourseFileAnalyzer={analyze};
})();
