/* 课程文件分析器：只在浏览器内解析 .ms14，保存结构摘要，不保存原始电路文件。 */
(function(){
  'use strict';
  const clean = value => String(value || '').replace(/&amp;/g,'&').replace(/^&ASC/,'').trim();
  const valuesOf = node => {
    const values = [...node.querySelectorAll('CiaCollString Item[Value]')].map(x => clean(x.getAttribute('Value')));
    const strings = [...node.querySelectorAll('CiaCString[String]')].map(x => clean(x.getAttribute('String')));
    return [...new Set([...values, ...strings].filter(Boolean))];
  };
  const matches = (values, re) => values.some(value => re.test(value));
  function analyze(xml, filename){
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('MS14 内部 XML 无法解析');
    const components = [...doc.querySelectorAll('CiComponent')].map(node => {
      const values = valuesOf(node);
      const ports = [...node.querySelectorAll(':scope > Ports > Item[CiID]')].map(x => x.getAttribute('CiID'));
      return {ref:clean(node.getAttribute('LocalName')), model:node.getAttribute('Model') || '', values, ports};
    });
    const ports = new Map([...doc.querySelectorAll('CiPort')].map(node => [node.parentElement?.getAttribute('CiID') || node.getAttribute('id') || node.getAttribute('CiID') || '', {
      name:clean(node.getAttribute('LocalName')), nodes:[...node.querySelectorAll(':scope > Nodes > Item[CiID]')].map(x => x.getAttribute('CiID'))
    }]));
    const componentStatus = components.map(component => ({...component, connected:component.ports.some(id => (ports.get(id)?.nodes || []).length > 0)}));
    const connectedCount = componentStatus.filter(x => x.connected).length;
    const counters=components.filter(x=>matches(x.values, /74LS90|74LS160|74LS390|DECADE COUNTER/i));
    const displays=components.filter(x=>matches(x.values, /DCD_HEX|74LS48|HEX_DISPLAY|7.?SEG/i));
    const clocks=components.filter(x=>matches(x.values, /LM?555|555 TIMER|CLOCK_SOURCE|CLOCK_VOLTAGE|DIGITAL_CLOCK|TIMER/i));
    const andGates=components.filter(x=>matches(x.values, /74LS08|7408|2.?INPUT AND|AND08/i));
    const orGates=components.filter(x=>matches(x.values, /74LS32|7432|2.?INPUT OR/i));
    const debounce=components.filter(x=>matches(x.values, /7414|7432|SCHMITT|BUTTON|SWITCH/i));
    const power=components.filter(x=>matches(x.values, /VCC|GROUND|GND|POWER_SOURCES/i));
    const componentCount=components.length;
    const connectionRate=componentCount?connectedCount/componentCount:0;
    const checks=[
      {key:'clock',label:'时基来源',ok:clocks.length>0,detail:clocks.length?`识别 ${clocks.length} 个时基/时钟相关器件`:'未识别 555 或 DIGITAL_CLOCK 时基'},
      {key:'counter',label:'计数链',ok:counters.length>=4,detail:`识别 ${counters.length} 个计数器，数字电子时钟主线通常需要秒、分、时级联`},
      {key:'display',label:'显示链',ok:displays.length>=4,detail:`识别 ${displays.length} 个显示/译码器件`},
      {key:'reset',label:'边界回零',ok:andGates.length>0,detail:andGates.length?'识别到与门，可进一步核对 60/24 进制回零连接':'未识别与门回零逻辑，需检查 60/24 进制边界'},
      {key:'debounce',label:'调时与去抖',ok:debounce.length>0,detail:debounce.length?'识别到按键/去抖/逻辑接口相关器件':'未识别按键去抖或调时接口，若方案不含调时需在报告说明'},
      {key:'connectivity',label:'网络连接覆盖',ok:connectionRate>=0.8,detail:`${connectedCount}/${componentCount} 个器件至少连接到一个网络节点（${Math.round(connectionRate*100)}%）`}
    ];
    const score=Math.min(100,checks.reduce((sum,x)=>sum+(x.ok?Math.round(100/checks.length):0),0));
    const suggestions=[];
    const questions=[];
    if(!clocks.length){suggestions.push('补充 555 或 DIGITAL_CLOCK 时基，并用示波器记录实测频率和测点。');questions.push('你的秒脉冲来自哪里？如何证明输入计数器的频率接近 1 Hz？');}
    if(counters.length<4){suggestions.push('核对秒、分、时三级计数器及级联进位，说明当前文件是局部电路还是完整时钟。');questions.push('当前文件中秒、分、时计数器分别是哪几片？59→00 的进位从哪个引脚到下一级？');}
    if(displays.length<4){suggestions.push('补充各位译码/显示链，写明 QA/QB/QC/QD 与 A/B/C/D 的对应关系。');questions.push('显示链采用 DCD_HEX 还是 74LS48？如何逐位验证 0—9 的显示正确？');}
    if(!andGates.length){suggestions.push('补充或标注 60/24 进制回零逻辑，并保留 59→00、23→00 边界证据。');questions.push('23:59:59 如何变为 00:00:00？请指出 QB、QC、7408 和 R0 的连接。');}
    if(!debounce.length){suggestions.push('如果包含调时，请补充按键去抖和单次脉冲记录；如果不含调时，请在报告中说明。');questions.push('一次按键为什么只产生一次有效计数？你用哪个测点验证了去抖？');}
    if(connectionRate<0.8){suggestions.push('存在未接入网络的器件，先检查电源、地线、控制脚和悬空输入，再进行功能判断。');questions.push('哪些器件或引脚尚未接入网络？它们是否是预留器件，还是尚未完成连接？');}
    if(!suggestions.length){suggestions.push('结构要素基本齐全。下一步用示波器完成时基、进位和边界波形记录，再提交教师复核。');questions.push('请展示 1 Hz、59→00、23→00 三组波形，并解释每个边沿对应的电路动作。');}
    return {version:1,filename,format:'Multisim .ms14 压缩 XML',parsedAt:new Date().toISOString(),score,level:score>=85?'结构较完整':score>=60?'需补充证据':'需要先完善结构',componentCount,connectedCount,connectionRate,counts:{clocks:clocks.length,counters:counters.length,displays:displays.length,andGates:andGates.length,orGates:orGates.length,debounce:debounce.length,power:power.length},checks,suggestions,questions,components:componentStatus.slice(0,80).map(x=>({ref:x.ref,model:x.model,values:x.values.slice(0,12),connected:x.connected}))};
  }
  window.CourseFileAnalyzer={analyze};
})();
