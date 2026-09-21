/* 课程示意图与知识图谱：全部为内联 SVG，无外部依赖，可在离线课堂使用。
   图形内容依据《实验四 电子时钟综合设计》指导手册（2026年5月修订）。 */
(function(){
  'use strict';
  const C={ink:'#163b52',muted:'#5d737c',line:'#c8d6d8',green:'#087b69',greenBg:'#edf8f4',blue:'#235dad',blueBg:'#eef4fb',amber:'#a4660f',amberBg:'#fff4df',violet:'#5a4bb8',violetBg:'#f2f0fa',red:'#b22d30',redBg:'#fdeeee',white:'#ffffff'};
  const t=(x,y,s,o)=>`<text x="${x}" y="${y}" font-size="${o&&o.size||13}" fill="${o&&o.fill||C.ink}" font-weight="${o&&o.weight||500}" text-anchor="${o&&o.anchor||'start'}">${s}</text>`;
  const mono=(x,y,s,o)=>`<text x="${x}" y="${y}" font-size="${o&&o.size||11.5}" fill="${o&&o.fill||C.muted}" font-family="ui-monospace,Consolas,monospace" text-anchor="${o&&o.anchor||'start'}">${s}</text>`;
  const rect=(x,y,w,h,o)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o&&o.rx!=null?o.rx:9}" fill="${o&&o.fill||C.white}" stroke="${o&&o.stroke||C.line}" stroke-width="${o&&o.sw||1}"/>`;
  const ln=(x1,y1,x2,y2,o)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o&&o.stroke||C.line}" stroke-width="${o&&o.sw||1.5}" ${o&&o.dash?`stroke-dasharray="${o.dash}"`:''}/>`;
  const pl=(d,o)=>`<path d="${d}" fill="${o&&o.fill||'none'}" stroke="${o&&o.stroke||C.line}" stroke-width="${o&&o.sw||1.5}" ${o&&o.marker?`marker-end="url(#${o.marker})"`:''} ${o&&o.dash?`stroke-dasharray="${o.dash}"`:''}/>`;
  const mk=(id,color)=>`<defs><marker id="${id}" markerWidth="10" markerHeight="10" refX="7.5" refY="3" orient="auto"><path d="M0,0 L7.5,3 L0,6 z" fill="${color||C.green}"/></marker></defs>`;
  const svg=(w,h,body)=>`<svg class="v3-fig" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

  /* ① 系统总体架构 */
  function figSystem(){
    const bw=116,gap=52,x0=9;
    const items=[
      {x:x0,title:'555 时基',sub:'多谐振荡器',mem:'1 Hz 秒脉冲',fill:C.amberBg,stroke:'#e8c58b'},
      {x:x0+(bw+gap),title:'秒计数器',sub:'U1 + U2',mem:'六十进制 00→59',fill:C.greenBg,stroke:'#8bcdbd'},
      {x:x0+(bw+gap)*2,title:'分计数器',sub:'U3 + U4',mem:'六十进制 00→59',fill:C.greenBg,stroke:'#8bcdbd'},
      {x:x0+(bw+gap)*3,title:'时计数器',sub:'U5 + U6',mem:'二十四进制 00→23',fill:C.greenBg,stroke:'#8bcdbd'},
      {x:x0+(bw+gap)*4,title:'译码显示',sub:'6 × DCD_HEX',mem:'HH : MM : SS',fill:C.blueBg,stroke:'#a9c2e2'}
    ];
    let s=mk('sys',C.green);
    items.forEach(it=>{
      s+=rect(it.x,74,bw,86,{fill:it.fill,stroke:it.stroke});
      s+=t(it.x+bw/2,98,it.title,{anchor:'middle',size:13.5,weight:800});
      s+=t(it.x+bw/2,118,it.sub,{anchor:'middle',size:11.5,fill:C.muted});
      s+=mono(it.x+bw/2,144,it.mem,{anchor:'middle',size:11});
    });
    items.forEach((it,i)=>{
      if(i>=items.length-1)return;
      const x1=it.x+bw,y=117,x2=items[i+1].x;
      s+=pl(`M${x1} ${y} H${x2-10}`,{marker:'sys',stroke:C.green,sw:1.8});
      const lab=['1 Hz','U2.QC ↓','U4.QC ↓','BCD'][i];
      s+=rect((x1+x2)/2-26,y-31,52,15,{fill:'#fff',stroke:'none',rx:4});
      s+=t((x1+x2)/2,y-20,lab,{anchor:'middle',size:10,fill:C.green,weight:700});
    });
    s+=rect(9,182,788,54,{fill:'#f7fbfa',stroke:'#d9e7e4'});
    s+=t(25,203,'进位只在“59→00”和“23→00”的瞬间发生，且必须由前级十位芯片的 QC 引脚下降沿驱动——',
      {size:12.5,weight:700});
    s+=t(25,222,'不要把与门的复位脉冲当作进位信号（脉冲极窄，下一级可能识别不到）。',{size:12.5,fill:C.muted});
    return svg(806,252,s);
  }

  /* ② 74LS90 结构与接法 */
  function fig74LS90(){
    let s=mk('ar90',C.green);
    s+=rect(18,20,376,236,{fill:C.white,stroke:'#dbe6e8'});
    s+=t(34,44,'74LS90 内部：一个 ÷2 + 一个 ÷5',{size:13.5,weight:800});
    s+=rect(34,60,120,52,{fill:C.violetBg,stroke:'#c3bce6'});
    s+=t(94,82,'÷ 2 触发器',{anchor:'middle',size:12.5,weight:700});
    s+=mono(94,99,'由 CPA 驱动',{anchor:'middle'});
    s+=rect(232,60,144,52,{fill:C.violetBg,stroke:'#c3bce6'});
    s+=t(304,82,'÷ 5 计数器',{anchor:'middle',size:12.5,weight:700});
    s+=mono(304,99,'由 CPB 驱动',{anchor:'middle'});
    s+=pl('M154 86 H223',{marker:'ar90',stroke:C.violet,sw:1.8});
    s+=mono(188,78,'QA → CPB',{anchor:'middle',fill:C.violet});
    s+=mono(94,132,'CPA(Pin14)',{anchor:'middle'});
    s+=mono(304,132,'QB QC QD',{anchor:'middle'});
    s+=pl('M94 138 V152',{stroke:C.green,sw:1.6});
    s+=pl('M304 138 V152',{stroke:C.green,sw:1.6});
    s+=t(94,168,'下降沿触发',{anchor:'middle',size:11,fill:C.green,weight:700});
    s+=t(304,168,'权值 2 / 4 / 8',{anchor:'middle',size:11,fill:C.green,weight:700});
    s+=mono(34,200,'QA 接回 CPB 完成内部级联，构成十进制 0→9→0。',{size:11.5});
    s+=mono(34,222,'R0 与 R9 四个控制脚平时必须可靠接地，',{size:11.5});
    s+=mono(34,242,'否则该片要么不走数、要么随机复位。',{size:11.5,fill:C.red});
    const rows=[['CPA (Pin14)','时钟输入 A，下降沿触发'],['CPB (Pin1)','时钟输入 B，下降沿触发'],['QA (Pin12)','输出权值 1（LSB）'],['QB (Pin9)','输出权值 2'],['QC (Pin8)','权值 4，进位提取点'],['QD (Pin11)','输出权值 8（MSB）'],['R0(1) Pin2 / R0(2) Pin3','复位端，正常计数接 GND'],['R9(1) Pin6 / R9(2) Pin7','置 9 端，正常计数接 GND']];
    s+=rect(410,20,378,236,{fill:C.white,stroke:'#dbe6e8'});
    s+=t(426,44,'关键引脚一览',{size:13.5,weight:800});
    rows.forEach((r,i)=>{const y=74+i*23;
      s+=mono(426,y,r[0],{size:10,fill:C.ink});
      s+=t(592,y,r[1],{size:10,fill:C.muted});
      if(i<rows.length-1)s+=ln(426,y+8,772,y+8,{stroke:'#f0f5f5'});
    });
    return svg(806,268,s);
  }

  /* ③ 进位时序：U2 计数 0→6→0，QC 下降沿 */
  function figCarry(){
    let s=mk('arcy',C.red);
    const x0=52,step=88,hi=58,lo=104;
    const seq=[['0','0000'],['1','0001'],['2','0010'],['3','0011'],['4','0100'],['5','0101'],['6','0110'],['0','0000']];
    const qcHigh=i=>[4,5,6].includes(i);
    s+=t(18,30,'U2（十位）计数值与 QC 的下降沿',{size:13.5,weight:800});
    s+=ln(x0,110,x0+step*8,110,{stroke:C.line});
    s+=mono(18,64,'QC',{size:12,fill:C.ink});
    seq.forEach((it,i)=>{
      const x=x0+i*step;
      s+=ln(x,hi,x,lo,{stroke:'#e4ebec'});
      s+=t(x+step/2,126,it[0],{anchor:'middle',size:11,fill:C.ink});
      s+=mono(x+step/2,142,it[1],{anchor:'middle',size:10.5});
      const on=qcHigh(i);
      s+=ln(x,on?hi:lo,x+step,on?hi:lo,{stroke:on?C.green:C.muted,sw:2.6});
      if(i>0&&qcHigh(i-1)!==on)s+=ln(x,hi,x,lo,{stroke:on?C.green:C.muted,sw:2.6});
    });
    const fx=x0+step*7+step/2;
    s+=ln(fx,hi-14,fx,lo+16,{stroke:C.red,sw:1.6,dash:'4 3'});
    s+=t(fx,hi-20,'复位瞬间',{anchor:'middle',size:10.5,fill:C.red,weight:800});
    s+=t(786,154,'下降沿 → 驱动 U3.CPA',{anchor:'end',size:11,fill:C.red,weight:800});
    s+=rect(18,168,788,50,{fill:C.greenBg,stroke:'#b9ddd3'});
    s+=t(34,190,'QC 在计数值 4 时变高，经过 5、6 保持为高，直到被复位回 0 的瞬间产生 1→0 下降沿。',{size:12,weight:700});
    s+=t(34,208,'这个下降沿宽度足够被下一级计数器可靠捕获；而与门复位脉冲只有几十纳秒，不能作为进位。',{size:12,fill:C.muted});
    return svg(806,228,s);
  }

  /* ④ 555 多谐振荡器 */
  function fig555(){
    let s=mk('ar555',C.green);
    /* 上：电路与接线 */
    s+=rect(18,16,788,150,{fill:C.white,stroke:'#dbe6e8'});
    s+=t(34,38,'555 多谐振荡器：充电走 RA + RB，放电只走 RB',{size:12.5,weight:800});
    s+=t(506,38,'接线要点',{size:12.5,weight:800,fill:C.green});
    s+=rect(40,56,124,94,{fill:C.violetBg,stroke:'#c3bce6'});
    s+=t(102,74,'LM555',{anchor:'middle',size:13,weight:800});
    [['Pin7 DIS',92],['Pin6 THR',106],['Pin2 TRI',120],['Pin5 CON',134]].forEach(r=>s+=mono(46,r[1],r[0],{size:9,fill:C.ink}));
    s+=ln(102,56,102,30,{stroke:C.amber,sw:2});
    s+=t(108,52,'+5 V（Pin8）',{size:9.5,fill:C.amber,weight:700});
    s+=ln(102,150,102,158,{stroke:C.muted,sw:2});
    s+=t(96,162,'GND（Pin1）',{size:9.5,fill:C.muted,weight:700,anchor:'end'});
    s+=pl('M164 108 H248',{marker:'ar555',stroke:C.green,sw:2});
    s+=t(254,104,'1 Hz 方波',{size:11.5,fill:C.green,weight:700});
    s+=mono(254,120,'Pin3 OUT → U1.CPA',{size:10});
    [['RA 10 kΩ  → Pin7',64],['RB 68 kΩ（100 kΩ 电位器微调）',86],['C 10 μF → Pin6 / Pin2',108],['Cbypass 0.01 μF → Pin5',130]].forEach(r=>s+=mono(470,r[1],r[0],{size:10.5,fill:C.ink}));
    /* 下：公式 */
    s+=rect(18,178,788,134,{fill:'#f8fbfa',stroke:'#d9e7e4'});
    s+=t(34,200,'关键公式与典型参数（RA=10 kΩ，RB=68 kΩ，C=10 μF）',{size:12.5,weight:800,fill:C.green});
    const bars=[['充电时间','T1 = 0.693 × (RA + RB) × C ≈ 0.54 s'],['放电时间','T2 = 0.693 × RB × C ≈ 0.47 s'],['振荡周期','T = 0.693 × (RA + 2RB) × C ≈ 1.01 s']];
    const bars2=[['振荡频率','f = 1.44 / [(RA + 2RB) × C] ≈ 0.99 Hz'],['占空比','D = (RA + RB)/(RA + 2RB)，恒大于 50%'],['课程窗口','0.95—1.05 Hz 仅表示进入设定窗口']];
    bars.forEach((r,i)=>{const y=226+i*22;s+=t(34,y,r[0],{size:11,weight:700,fill:C.green});s+=mono(104,y,r[1],{size:10,fill:C.ink})});
    bars2.forEach((r,i)=>{const y=226+i*22;s+=t(412,y,r[0],{size:11,weight:700,fill:C.green});s+=mono(482,y,r[1],{size:10,fill:C.ink})});
    s+=t(34,296,'Pin4 RST 必须接 VCC，否则 555 不振荡；时钟源建议用 DIGITAL_CLOCK 或 PULSE_VOLTAGE（TR=TF=5 ns），',{size:11,weight:700,fill:C.red});
    s+=t(34,312,'理想方波源 CLOCK_VOLTAGE 的上升/下降时间为零，会产生吉布斯毛刺，导致计数器一次边沿跳多下。',{size:11,fill:C.muted});
    return svg(806,324,s);
  }

  /* ⑤ 六进制复位与六十进制计数 */
  function figHexReset(){
    let s=mk('arhx',C.violet);
    s+=t(18,30,'六十进制：两片 74LS90 级联 + 一个 7408 复位到 6',{size:13.5,weight:800});
    s+=rect(24,52,150,72,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(99,78,'U1 秒个位',{anchor:'middle',size:12.5,weight:800});
    s+=mono(99,98,'÷ 10  ▸ 0→9→0',{anchor:'middle'});
    s+=rect(206,52,150,72,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(281,78,'U2 秒十位',{anchor:'middle',size:12.5,weight:800});
    s+=mono(281,98,'÷ 6  ▸ 0→5→0',{anchor:'middle'});
    s+=pl('M174 88 H197',{marker:'arhx',stroke:C.green,sw:1.8});
    s+=mono(185,80,'QD↓',{anchor:'middle',size:10});
    s+=rect(392,52,166,72,{fill:C.violetBg,stroke:'#c3bce6'});
    s+=t(475,78,'7408 与门',{anchor:'middle',size:12.5,weight:800});
    s+=mono(475,98,'检测 U2 = 0110',{anchor:'middle'});
    s+=pl('M356 74 H383',{marker:'arhx',stroke:C.violet,sw:1.8});
    s+=mono(370,66,'QB',{anchor:'middle',size:10});
    s+=pl('M356 100 H383',{marker:'arhx',stroke:C.violet,sw:1.8});
    s+=mono(370,116,'QC',{anchor:'middle',size:10});
    s+=rect(596,52,190,72,{fill:C.redBg,stroke:'#e6b9ba'});
    s+=t(691,76,'R0(1) + R0(2)',{anchor:'middle',size:12.5,weight:800});
    s+=mono(691,96,'U1 与 U2 四端并联复位',{anchor:'middle'});
    s+=pl('M558 88 H587',{marker:'arhx',stroke:C.red,sw:1.8});
    s+=rect(24,146,762,52,{fill:'#f8fbfa',stroke:'#d9e7e4'});
    s+=mono(40,168,'计数序列  … 57  58  59  60(瞬态)  00  01 …',{size:12,fill:C.ink});
    s+=t(40,188,'QB 与 QC 同时为 1 的时刻只出现在“6”，因此不会误复位；复位后 QB/QC 自动回到 0，与门输出随之变低。',{size:11.5,fill:C.muted});
    s+=rect(24,208,762,34,{fill:C.amberBg,stroke:'#eed5a7'});
    s+=t(40,230,'秒→分进位：取 U2.QC(Pin8) 接到 U3.CPA(Pin14)；分→时进位：取 U4.QC 接到 U5.CPA。',{size:12,weight:700,fill:C.amber});
    return svg(806,254,s);
  }

  /* ⑥ DCD_HEX 位序 */
  function figBcdOrder(){
    let s=mk('arbcd',C.blue);
    s+=t(18,30,'位序对应：QA→A（最右），QD→D（最左）',{size:13.5,weight:800});
    const chip=[['QD','权值 8','D','最左'],['QC','权值 4','C','左二'],['QB','权值 2','B','右二'],['QA','权值 1','A','最右']];
    chip.forEach((r,i)=>{
      const x=30+i*190;
      s+=rect(x,50,170,70,{fill:C.greenBg,stroke:'#8bcdbd'});
      s+=t(x+44,78,r[0],{anchor:'middle',size:15,weight:800,fill:C.green});
      s+=mono(x+44,96,r[1],{anchor:'middle'});
      s+=pl(`M${x+92} 85 H${x+122}`,{marker:'arbcd',stroke:C.blue,sw:2});
      s+=rect(x+124,58,40,52,{fill:C.blueBg,stroke:'#a9c2e2'});
      s+=t(x+144,88,r[2],{anchor:'middle',size:16,weight:800,fill:C.blue});
      s+=mono(x+144,124,r[3],{anchor:'middle',size:10.5});
    });
    s+=rect(30,142,750,58,{fill:C.redBg,stroke:'#e6b9ba'});
    s+=t(46,164,'最常见的接线错误：把 QA 接到 D（最左）、QD 接到 A（最右），高低位互换，数码管显示乱码。',
      {size:12,weight:700,fill:C.red});
    s+=mono(46,186,'验证方法：用 4 个 SPDT 开关固定输入 0000→1001，逐个核对显示字符与 BCD 码是否一致。',{size:11.5,fill:C.muted});
    return svg(806,216,s);
  }

  /* ⑦ 二十四进制复位 */
  function fig24Reset(){
    let s=mk('ar24',C.violet);
    s+=t(18,30,'二十四进制：U6.QB 与 U5.QC 经 7408 同时复位两片时计数器',{size:13.5,weight:800});
    s+=rect(24,52,140,68,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(94,78,'U5 时个位',{anchor:'middle',size:12.5,weight:800});
    s+=mono(94,98,'÷ 10',{anchor:'middle'});
    s+=rect(186,52,140,68,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(256,78,'U6 时十位',{anchor:'middle',size:12.5,weight:800});
    s+=mono(256,98,'÷ 3 ▸ 0→2',{anchor:'middle'});
    s+=pl('M164 86 H177',{marker:'ar24',stroke:C.green,sw:1.8});
    s+=rect(368,52,152,68,{fill:C.violetBg,stroke:'#c3bce6'});
    s+=t(444,78,'7408 与门',{anchor:'middle',size:12.5,weight:800});
    s+=mono(444,98,'检测 24',{anchor:'middle'});
    s+=pl('M326 70 H359',{marker:'ar24',stroke:C.violet,sw:1.8});
    s+=mono(342,62,'U6.QB',{anchor:'middle',size:10});
    s+=pl('M94 120 V144 H359 V120',{stroke:C.violet,sw:1.6});
    s+=mono(120,138,'U5.QC',{size:10,fill:C.violet});
    s+=rect(556,52,230,68,{fill:C.redBg,stroke:'#e6b9ba'});
    s+=t(671,78,'R0(1) + R0(2)',{anchor:'middle',size:12.5,weight:800});
    s+=mono(671,98,'U5 与 U6 四端并联复位',{anchor:'middle'});
    s+=pl('M520 86 H547',{marker:'ar24',stroke:C.red,sw:1.8});
    s+=rect(24,148,762,44,{fill:'#f8fbfa',stroke:'#d9e7e4'});
    s+=mono(40,175,'验证序列  22 → 23 → 24(瞬态) → 00 → 01 …  并保存 23:59:59 → 00:00:00 完整记录',{size:12,fill:C.ink});
    s+=rect(24,202,762,34,{fill:C.amberBg,stroke:'#eed5a7'});
    s+=t(40,224,'复位后 QB、QC 回到 0，与门输出自动变低——如果计数器停在 24 不动，通常是 QB 或 QC 没有真正接入与门。',{size:11.5,weight:700,fill:C.amber});
    return svg(806,248,s);
  }

  /* ⑧ 按键去抖与调时合并 */
  function figDebounce(){
    let s=mk('ardb',C.green);
    s+=t(18,30,'调分通道：去抖按键脉冲与正常进位经 7432 或门合并后送入 U3.CPA',{size:13.5,weight:800});
    s+=rect(24,48,238,86,{fill:C.amberBg,stroke:'#e8c58b'});
    s+=t(143,72,'按键 + RC + 7414×2',{anchor:'middle',size:12.5,weight:800});
    s+=mono(143,92,'PB_NO │ 10 kΩ 上拉 │ 0.1 μF',{anchor:'middle'});
    s+=mono(143,110,'经两级施密特反相 → 干净单脉冲',{anchor:'middle'});
    s+=pl('M262 91 H300',{marker:'ardb',stroke:C.green,sw:2});
    s+=mono(281,83,'1B',{anchor:'middle',size:10.5,fill:C.green});
    s+=rect(310,48,150,86,{fill:C.violetBg,stroke:'#c3bce6'});
    s+=t(385,88,'7432 或门',{anchor:'middle',size:13,weight:800});
    s+=mono(385,108,'1A + 1B → 1Y',{anchor:'middle'});
    s+=pl('M460 91 H520',{marker:'ardb',stroke:C.green,sw:2});
    s+=rect(528,48,150,86,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(603,84,'U3.CPA',{anchor:'middle',size:13,weight:800});
    s+=mono(603,104,'分个位计数',{anchor:'middle'});
    s+=rect(24,148,238,52,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(143,172,'U2.QC 秒→分进位',{anchor:'middle',size:12.5,weight:800});
    s+=mono(143,190,'正常计时通道',{anchor:'middle'});
    s+=pl('M262 174 H300',{marker:'ardb',stroke:C.green,sw:2});
    s+=mono(281,166,'1A',{anchor:'middle',size:10.5,fill:C.green});
    s+=pl('M300 174 H310',{stroke:C.green,sw:2});
    s+=rect(24,212,762,42,{fill:'#f8fbfa',stroke:'#d9e7e4'});
    s+=t(40,232,'平时按键断开，1B 为低，或门输出 = 正常进位；按住调分键时 1B 输出 1 Hz 脉冲，分计数器每秒 +1。',
      {size:11.5,weight:700,fill:C.ink});
    s+=mono(40,248,'如果按下不计数、松开才计数，说明极性反了：去掉第二级 7414，只用一级反相。',{size:11,fill:C.muted});
    return svg(806,266,s);
  }

  /* ⑨ 74LS160 同步计数器对比 */
  function fig160(){
    let s=mk('ar160',C.blue);
    s+=t(18,30,'选做替代方案：74LS160 同步十进制计数器',{size:13.5,weight:800});
    s+=rect(24,48,196,110,{fill:C.blueBg,stroke:'#a9c2e2'});
    s+=t(122,72,'74LS160',{anchor:'middle',size:14,weight:800});
    [['CLK','同步时钟（上升沿）',90],['ENP / ENT','计数使能',108],['CLR','异步清零',126],['LOAD','同步置数',144]].forEach(r=>{s+=mono(40,r[2],r[0],{size:11,fill:C.ink});s+=t(112,r[2],r[1],{size:10,fill:C.muted})});
    s+=rect(250,48,250,110,{fill:'#f8fbfa',stroke:'#d9e7e4'});
    s+=t(266,72,'与 74LS90 的差异',{size:12.5,weight:800,fill:C.blue});
    s+=t(266,94,'• 同步触发，所有输出同时翻转',{size:11.5,fill:C.ink});
    s+=t(266,114,'• 进位用 RCO，不用 QC 下降沿',{size:11.5,fill:C.ink});
    s+=t(266,134,'• 级联不需要 RC 展宽，毛刺更少',{size:11.5,fill:C.ink});
    s+=pl('M514 103 H556',{marker:'ar160',stroke:C.blue,sw:2});
    s+=rect(566,48,220,110,{fill:C.greenBg,stroke:'#8bcdbd'});
    s+=t(676,76,'本课程要求',{anchor:'middle',size:12.5,weight:800,fill:C.green});
    s+=t(676,100,'主线用 74LS90 完成',{anchor:'middle',size:11.5});
    s+=t(676,120,'74LS160 作为选做拓展',{anchor:'middle',size:11.5});
    s+=mono(676,142,'需另附方案差异证据',{anchor:'middle'});
    s+=rect(24,172,762,44,{fill:C.amberBg,stroke:'#eed5a7'});
    s+=t(40,200,'选用 74LS160 时必须重新核对 CLK、ENP/ENT、CLR、LOAD 和 RCO；不能沿用 74LS90 的引脚判据。',{size:12,weight:700,fill:C.amber});
    return svg(806,226,s);
  }


  window.COURSE_FIGURES={
    system:figSystem(),ls90:fig74LS90(),carry:figCarry(),timer555:fig555(),
    hexReset:figHexReset(),bcdOrder:figBcdOrder(),reset24:fig24Reset(),
    debounce:figDebounce(),ls160:fig160()
  };
})();
