/* 课程知识图谱（可交互）——数据依据《实验四 电子时钟综合设计》指导手册（2026年5月修订）、
   教学大纲与实验三前置内容整理。全部为内联 SVG + 原生 JS，无外部依赖，断网可用。
   视图：① 知识图谱 ② 能力与评价 ③ 故障诊断链 */
(function(){
  'use strict';

  /* ============================ 数据 ============================ */
  const MODULES=[
    {id:'M1',name:'时基',sub:'秒脉冲产生',code:'§1',hours:'2 学时',accent:'#f0a63c',
     desc:'555 接成多谐振荡器产生 1 Hz 秒脉冲，是整个时钟的“心脏”。时基不稳，后面所有计数都不可信。',
     points:[
       {id:'t1',code:'§1.1',short:'555 振荡原理',name:'555 多谐振荡器工作原理',
        principle:'RA 接 VCC→Pin7，RB 接 Pin7→Pin6/Pin2，C 接 Pin6/Pin2→GND。电容经 RA+RB 充电、只经 RB 放电，Pin2/Pin6 监测电容电压在 1/3VCC 与 2/3VCC 之间翻转，Pin3 输出连续方波。',
        formula:'充电 T1=0.693(RA+RB)C　放电 T2=0.693·RB·C　周期 T=0.693(RA+2RB)C',
        mistakes:['占空比恒大于 50%，不能用它做精确对称方波。','Pin5 控制电压端未加 0.01 μF 旁路电容时输出频率易受干扰。'],
        probes:['Pin7 与 Pin6/2 汇接点：观察电容充放电三角波','Pin3：确认连续方波而非单脉冲']},
       {id:'t2',code:'§1.1',short:'1 Hz 参数',name:'1 Hz 时基参数计算与微调',key:true,card:'K1-02',
        principle:'取 RA=10 kΩ、RB=68 kΩ、C=10 μF，理论周期约 1.01 s、频率约 0.99 Hz。实际调试时用 100 kΩ 电位器替代 RB，边看示波器读数边调，直到周期精确为 1 s。',
        formula:'f = 1.44 / [(RA + 2RB) × C]',
        mistakes:['电容保持默认 ±10% 容差，频率怎么调都到不了 1 Hz；应在属性里把 Tolerance 设为 0%。','只按理论值填表，不做实测微调。'],
        probes:['示波器 CH-A 接 Pin3，Timebase 500 ms/Div','用 Cursor 读周期 T 与高电平时间 T1']},
       {id:'t3',code:'§1.1 · 附录7.3',short:'时钟源选择',name:'时钟源选择：为什么不用 CLOCK_VOLTAGE',key:true,
        principle:'CLOCK_VOLTAGE 是理想方波源，上升/下降时间为零，SPICE 数值求解时会产生吉布斯振荡毛刺，导致计数器一次边沿多次触发。手册推荐 DIGITAL_CLOCK（内置边沿时间）或 PULSE_VOLTAGE（设 TR=TF=5 ns）。',
        mistakes:['用 CLOCK_VOLTAGE 后出现“跳数”“随机复位”，误以为是接线问题。','调试时用 10 Hz / 100 Hz 快速验证，最后忘记切回 555 的 1 Hz。'],
        probes:['时钟输入端用示波器看边沿是否干净','若必须用 CLOCK_VOLTAGE，在输入端加 R=10 Ω + C=0.1 nF 低通']},
       {id:'t4',code:'§1.1',short:'Pin4 接 VCC',name:'555 关键引脚：Pin4 复位端必须接 VCC',card:'K1-02',
        principle:'Pin4 为复位端，低电平强制 555 停振。手册明确指出“Pin4 不接 VCC 会导致 555 不振荡”，这是初学者最常见的错误之一。',
        mistakes:['Pin4 悬空 → 555 完全不振荡，表现为“显示不计数”。'],
        probes:['上电后用探针测 Pin4 电位，必须为高电平','Pin8 接 +5 V、Pin1 接 GND 是否可靠连接']}
     ]},
    {id:'M2',name:'计数',sub:'秒 / 分 / 时',code:'§2',hours:'4 学时',accent:'#2fd1a8',
     desc:'6 片 74LS90 构成秒、分、时三级计数器。异步计数器的关键是“下降沿”和“控制脚不能悬空”。',
     points:[
       {id:'c1',code:'§2.1',short:'74LS90 结构',name:'74LS90 内部结构与十进制接法',key:true,card:'K1-02',
        principle:'内部由一个 ÷2（CPA 驱动，QA 输出）和一个 ÷5（CPB 驱动，QB/QC/QD 输出）组成。把 QA 接回 CPB 完成内部级联，即构成 0→9→0 的十进制计数器。',
        formula:'QA 权值 1（LSB）· QB 2 · QC 4 · QD 8（MSB）',
        mistakes:['忘记把 QA 接回 CPB，计数器只按 ÷5 工作。','元件库里 74LS90D / 74LS90N / 7490N 功能相同，但引脚编号显示方式不同。'],
        probes:['CPA(Pin14) 与 QA~QD 同屏：确认 0000→1001 循环']},
       {id:'c2',code:'§2.1',short:'QA→CPB',name:'BCD 十进制接法与引脚定义',card:'K1-02',
        principle:'正常计数时 R0(1)、R0(2)、R9(1)、R9(2) 四个控制脚必须全部接 GND；CPA(Pin14)、CPB(Pin1) 均为下降沿触发；QA(Pin12)、QB(Pin9)、QC(Pin8)、QD(Pin11) 依次输出权值 1-2-4-8。',
        mistakes:['把 CPA / CPB 理解成上升沿触发，导致边沿分析整体错位。'],
        probes:['逐个测量四个控制脚电位，确认均为低电平']},
       {id:'c3',code:'§2.1',short:'R0/R9 接地',name:'控制脚悬空是“计数器不动”的头号原因',key:true,
        principle:'R0(1)、R0(2) 为高有效复位端，R9(1)、R9(2) 为高有效置 9 端。TTL 器件未连接的输入端在 Multisim 中可能被当作高电平，因此悬空会导致计数器一直复位或被置 9，表现为不走数。',
        mistakes:['只接了与门输出，没有保留 10 kΩ 下拉电阻。','四个控制脚中漏接一个，现象与前三个连接时完全不同。'],
        probes:['每片 74LS90 的 Pin2、Pin3、Pin6、Pin7 逐一确认','与门输出接 R0 后，复位瞬间是否自动回到低电平']},
       {id:'c4',code:'§2.1 · 思考题',short:'级联延迟',name:'异步级联的传输延迟与毛刺',
        principle:'74LS90 是异步计数器，多级级联时延迟逐级累加（秒→分→时）。在 59:59:59→00:00:00 这类多级同时翻转的边界，可能短暂出现非法 BCD 值，数码管会闪现 A—F。',
        mistakes:['把复位瞬态的 A—F 闪现当成故障，反复改接线。'],
        probes:['用逻辑分析仪同时看多级输出的翻转时序']}
     ]},
    {id:'M3',name:'译码显示',sub:'数码管与位序',code:'§3',hours:'2 学时',accent:'#4aa8e0',
     desc:'DCD_HEX 内部已含 BCD-七段译码器，4 个输入脚从左到右是 D-C-B-A，位序接反是乱码的头号原因。',
     points:[
       {id:'d1',code:'§3.1',short:'D-C-B-A 位序',name:'DCD_HEX 引脚位序 D-C-B-A',key:true,card:'K4-02',
        principle:'元件符号上的 4 个引脚从左到右为 D、C、B、A，权值分别是 8、4、2、1。counter 输出必须按权值对应连接：QA→A（最右）、QB→B、QC→C、QD→D（最左）。',
        mistakes:['把 QA 接到 D、QD 接到 A，高低位互换 → 数码管显示乱码。','只看“显示亮了”就判定通过，不逐位核对。'],
        probes:['用 4 个 SPDT 开关固定输入 0000→1001，逐项核对显示字符','DCD_HEX 四个输入脚是否都有明确电平，不能悬空']},
       {id:'d2',code:'§3.2',short:'BCD 验证表',name:'BCD 码到显示字符的验证方法',key:true,card:'K4-02',
        principle:'按 0000→1001 逐行固定输入，记录显示字符与 BCD 码的一一对应关系，形成可复核的译码功能表。输入 1010—1111 时显示 A—F，这是复位瞬态的合法现象。',
        mistakes:['用连续计数时“看起来正常”代替逐位固定输入验证。'],
        probes:['数码管输入与计数器输出之间的一一对应关系']},
       {id:'d3',code:'附录7.1',short:'74LS48 方案',name:'传统 74LS48 + 共阴极数码管方案',
        principle:'真实硬件中 BCD 无法直接驱动七段数码管，需要 74LS48 译码/驱动，a~g 各串 220 Ω 限流电阻，¬LT / ¬BI/RBO / ¬RBI 三个控制脚经 1 kΩ 上拉接 VCC。Multisim 中 74LS48D 模型存在驱动兼容问题，故本实验用 DCD_HEX 等价替代。',
        mistakes:['不知道仿真用 DCD_HEX 是为了回避 74LS48D 模型问题，误以为两者可以随意互换。'],
        probes:['对比两种方案在限流电阻与控制脚处理上的差异']}
     ]},
    {id:'M4',name:'进位与回零',sub:'60 / 24 进制',code:'§2.2—2.4',hours:'贯穿§2',accent:'#9a86e8',
     desc:'回零逻辑决定时钟能否正确进位。进位取 QC 下降沿，复位用 7408 检测状态，两者不能混用。',
     points:[
       {id:'r1',code:'§2.2',short:'QD 下降沿级联',name:'个位→十位：QD 下降沿驱动',key:true,card:'K3-01',
        principle:'U1（秒个位）从 9→0 时 QD 由 1 变 0，产生下降沿，接到 U2（秒十位）的 CPA，十位加 1。分、时的个位到十位同理（U3→U4、U5→U6）。',
        mistakes:['用 QA 或 QB 做级联，跳变条件不对，十位出现多余进位。'],
        probes:['U1.QD(Pin11) 与 U2.CPA(Pin14) 同屏，标出边沿时刻']},
       {id:'r2',code:'§2.4',short:'QC 进位提取',name:'59→00 进位：为什么取 QC 而不是与门输出',key:true,card:'K3-01',
        principle:'U2 的 QC 在计数值 4 时变高，经过 5、6 保持为高，直到被复位回 0 的瞬间产生完整的 1→0 下降沿，宽度足够被下一级捕获。与门的复位脉冲只有几十纳秒，下一级可能识别不到。',
        mistakes:['从与门输出取进位 → 进位时好时坏。','保留原来的 U2.QC→U3.CPA 直连线，同时再接或门，造成通道冲突。'],
        probes:['U2.QC(Pin8) 与 U3.CPA(Pin14) 同屏','秒位 59→00、U2.QC、分位变化的完整一次记录']},
       {id:'r3',code:'§2.2',short:'六进制复位',name:'六十进制反馈复位（检测 6）',card:'K3-01',
        principle:'7408 与门输入接 U2.QB(Pin9) 与 U2.QC(Pin8)，输出并联接到 U1、U2 的 R0(1) 与 R0(2) 共四个引脚。QB 与 QC 同时为 1 的状态只出现在“6”，因此不会误复位。',
        mistakes:['与门输出只接到十位芯片，个位不复位。','删掉 R0 的下拉电阻，复位后 R0 无法回到低电平。'],
        probes:['U2.QB、U2.QC、7408 输出、R0 四个测点','59→00 的完整波形']},
       {id:'r4',code:'§2.3',short:'24 进制复位',name:'二十四进制复位（检测 24 瞬态）',key:true,card:'K4-03',
        principle:'检测 U6.QB(Pin9)=1 且 U5.QC(Pin8)=1，即“24”这一瞬态，经 7408 同时复位 U5、U6 的 R0 四端。U6.QB 为 1 的区间内 U5 取 0—3 时 QC 都是 0，只有 U5=4 时 QC 才第一次变高。',
        mistakes:['与门输入端接错到 QA 或 QD，复位条件永远不成立，计数停在 24。','只并联到十位芯片，个位不复位。'],
        probes:['U6.QB、U5.QC、7408 输出、U5/U6 的 R0','完整记录 23:59:59 → 00:00:00']}
     ]},
    {id:'M5',name:'调时与去抖',sub:'按键与脉冲合并',code:'§8',hours:'含于§4',accent:'#ef7a5a',
     desc:'机械按键有抖动，必须经施密特整形后才能计数；调时脉冲与正常进位经或门合并，极性不能反。',
     points:[
       {id:'a1',code:'§8.1',short:'7414 去抖',name:'7414 施密特去抖与 RC 时间常数',key:true,card:'K5-01',
        principle:'10 kΩ 上拉 + 0.1 μF 滤波 + 两级 7414 施密特反相器，把按键的机械抖动整形成干净的单脉冲。RC 时间常数需大于 10 ms；两级串联是为了恢复正逻辑。',
        mistakes:['只用 RC 滤波不接施密特触发器，边沿缓慢，计数器在阈值附近多次翻转。','7414 供电脚 Pin14/Pin7 未接。'],
        probes:['节点 A（上拉点）看抖动原始波形','7414 Pin2 与 Pin4：对比去抖前后']},
       {id:'a2',code:'§8.2',short:'7432 合并',name:'7432 或门合并正常进位与调时脉冲',key:true,card:'K5-01',
        principle:'或门 1A 接 U2.QC（正常秒→分进位），1B 接去抖按键输出，1Y 接 U3.CPA。平时 1B 为低，输出等于正常进位；按住调分键时 1B 输出 1 Hz 脉冲，分计数器每秒 +1。调时用第二个门（2A=U4.QC，2Y=U5.CPA）。',
        mistakes:['忘记断开原来的 U2.QC→U3.CPA 直连线，或门被短路。','7432 供电脚未接，或门输出恒低。'],
        probes:['7432 的 1A、1B、1Y 三点','按住调分键时 U3.CPA 的脉冲速率']},
       {id:'a3',code:'§8.2',short:'脉冲极性',name:'单次按键对应一次有效边沿',
        principle:'分计数器 CPA 是下降沿触发。两级 7414 后输出为正逻辑，按键按下产生下降沿，正好触发一次计数。若按下不计数、松开才计数，说明极性反了，去掉第二级 7414 只用一级反相即可。',
        mistakes:['不测波形，只凭“按了没反应/跳了多个数”猜原因。'],
        probes:['一次按键对应 U3.CPA 上的一个计数边沿']}
     ]},
    {id:'M6',name:'拓展与稳定',sub:'选做与仿真设置',code:'§4.3 · 附录7.3',hours:'选做',accent:'#9ecb5a',
     desc:'同步计数器与报时属于拓展；仿真稳定性设置是所有实验的公共基础。',
     points:[
       {id:'x1',code:'思考题',short:'74LS160 对比',name:'74LS160 同步计数器替代方案',key:true,card:'K1-03',
        principle:'74LS160 所有输出在同一时钟上升沿翻转，进位由 RCO 给出，不存在异步级联的延迟累积。换成它以后 CLK、ENP/ENT、CLR、LOAD、RCO 都必须重新核对，不能沿用 74LS90 的 QC 下降沿判据。',
        mistakes:['把 74LS90 的“下降沿触发”套用到上升沿触发的 74LS160。','忽略 ENP/ENT 使能脚，计数器不走数。'],
        probes:['CLK 与 QA~QD 同屏，确认所有位同时翻转','ENP/ENT 与 RCO 的使能和进位条件']},
       {id:'x2',code:'§4.3',short:'整点报时',name:'整点报时（选做方案）',
        principle:'方案 A 在整点触发一声短鸣；手册给出更易实现的简化方案：检测分十位=5（U4 的 BCD 为 0101，即 QA=1 且 QC=1），与门输出接音频 555 的 Pin4。Pin4 高电平起振、低电平停振，因此报时会持续整个 50—59 分区间。',
        mistakes:['把与门输出当窄脉冲用，忽略 Pin4 需要的是持续电平。','音频 555 的 RA/RB/C 参数算错，频率偏离 1 kHz。'],
        probes:['与门输出电平在分十位=5 期间是否为高','音频 555 的 Pin3 输出与 Pin4 控制电平']},
       {id:'x3',code:'附录7.3',short:'仿真稳定性',name:'提高 Multisim 仿真稳定性的设置',key:true,
        principle:'① 时钟源优先 DIGITAL_CLOCK 或 PULSE_VOLTAGE；② Simulate → Interactive Simulation Settings 把 Maximum time step (TMAX) 设为 0.001 s 或更小，用高频测试时钟时设 1 μs；③ 每片 IC 的 VCC 与 GND 之间并 0.1 μF 去耦电容；④ 不悬空任何输入引脚；⑤ 每个模块单独保存 .ms14 备份。',
        mistakes:['用 1 kHz 测试时钟却保持默认步长，仿真结果不可信。','所有模块都堆在同一个 .ms14 里，出问题无法回溯。'],
        probes:['仿真设置与实际使用的时钟频率是否匹配']}
     ]}
  ];

  /* 跨模块先修关系（两端均为上图知识点） */
  const LINKS=[
    ['t2','c1'],['t3','c1'],['t2','t3'],
    ['c1','d1'],['c1','x1'],
    ['c3','r1'],['c3','r2'],['c3','x1'],
    ['r1','r2'],['r2','r4'],
    ['d1','d2'],
    ['a1','a2'],['a2','r2']
  ];

  const ABILITY=[
    {id:'A1',name:'需求分析',stage:'构思 Conceive',
     desc:'读懂任务书，明确时制（24 h）、显示位数（6 位）、校时要求与文件命名规范，写出可核查的需求条目。',
     task:'阶段一 · 需求与安全',evidence:'需求清单、制式说明、文件命名规范',rubric:'需求条目可核查，含安全与规范约束'},
    {id:'A2',name:'方案设计',stage:'设计 Design',
     desc:'选择时基、计数器、译码与调时器件，给出时基参数计算、计数链拓扑和边界逻辑的设计理由。',
     task:'阶段二 · 方案与计算',evidence:'器件选型表、时基参数计算、计数链拓扑图',rubric:'每个器件选择都有理由，参数可复算'},
    {id:'A3',name:'仿真实现',stage:'实现 Implement',
     desc:'在 Multisim 中按模块划分搭建电路，注意控制脚处理、时钟源选择和分模块备份。',
     task:'阶段三 · 仿真与波形',evidence:'.ms14 源文件、模块级仿真截图',rubric:'结构完整、端口无悬空、时钟源规范'},
    {id:'A4',name:'测量测试',stage:'实现 Implement',
     desc:'用示波器、逻辑分析仪、频率计获取 1 Hz、59→00、23→00 等关键测点的实测读数与波形。',
     task:'阶段三 · 仿真与波形',evidence:'关键测点读数、边界波形、位序核对表',rubric:'每个结论都能回到具体测点与读数'},
    {id:'A5',name:'故障诊断',stage:'运作 Operate',
     desc:'把故障现象转成“测点—判据—复测”的可执行任务，先假设再修改，一次只改一个条件。',
     task:'阶段四 · 联调与测试',evidence:'故障现象、假设、修改动作、复测结论、版本差异',rubric:'形成完整闭环，保留修改前后版本'},
    {id:'A6',name:'技术表达',stage:'复盘 Reflect',
     desc:'整理工程档案、实验报告与答辩材料，能说清设计取舍、未解决问题与下一步改进方向。',
     task:'阶段五/六 · 改进与答辩',evidence:'报告、答辩记录、档案清单、反思',rubric:'陈述与证据一致，能指出仍需教师确认的问题'}
  ];

  const EVIDENCE=[
    {name:'1 Hz 实测',detail:'0.95—1.05 Hz 仅为课程设定窗口，仍需教师核对波形',link:'t2'},
    {name:'59→00 进位波形',detail:'需含秒位、U2.QC、分位同屏与边沿时刻标注',link:'r2'},
    {name:'BCD 位序核对表',detail:'固定输入 0000→1001 的显示字符对照',link:'d1'},
    {name:'23:59:59→00:00:00',detail:'二十四进制回零的完整边界记录',link:'r4'},
    {name:'调时单次脉冲',detail:'一次按键对应一个有效计数边沿',link:'a3'},
    {name:'.ms14 源文件',detail:'按十维结构评分，定位端口与悬空缺口',link:'c3'},
    {name:'实验报告与答辩',detail:'含故障闭环、版本差异与反思',link:'x1'}
  ];

  const FAULTS=[
    {key:'no-count',label:'显示不计数',card:'K1-02',points:['555 Pin3','U1.CPA(Pin14)'],chain:'t4',
     step:['先测 555 Pin3 有无方波','再测 U1.CPA 有无有效边沿','检查 Pin4 是否接 VCC、VCC/GND 是否连接']},
    {key:'no-carry',label:'59 后分位不进位',card:'K3-01',points:['U2.QC(Pin8)','U3.CPA(Pin14)'],chain:'r2',
     step:['保存秒位、U2.QC、分位同屏波形','确认 59→00 时 QC 有完整下降沿','不要把 7408 窄复位脉冲当进位']},
    {key:'garbled',label:'显示乱码或位序错',card:'K4-02',points:['QA~QD','DCD_HEX 的 A~D'],chain:'d1',
     step:['逐位固定输入，记录显示字符','核对 QA→A（最右）、QD→D（最左）','检查有无输入脚悬空']},
    {key:'bounce',label:'一次按键跳数多次',card:'K5-01',points:['节点A','7414 Pin4','7432 1Y'],chain:'a1',
     step:['对比去抖前后波形','增大 RC 至 R×C > 10 ms','确认 7414 供电与两级串联']},
    {key:'no-reset',label:'23 后没有回到 00',card:'K4-03',points:['U6.QB(Pin9)','U5.QC(Pin8)','7408 输出','R0'],chain:'r4',
     step:['确认 QB、QC 真正接入与门','确认与门输出并联到两片 R0 四端','检查 R0 下拉电阻是否保留']},
    {key:'other',label:'其他故障',card:'K0-01',points:['第一个异常测点'],chain:'c3',
     step:['先记录第一个异常测点，不连续改线','保存当前版本，一次只改一个条件','复测后与修改前版本对比']}
  ];

  const STAT={modules:MODULES.length,points:MODULES.reduce((s,m)=>s+m.points.length,0),links:LINKS.length,cards:6,chapters:8};

  /* ============================ 工具 ============================ */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const polar=(cx,cy,r,deg)=>{const a=(deg-90)*Math.PI/180;return[cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  let uid=0;

  /* ============================ 视图一：知识图谱 ============================ */
  function viewGraph(){
    const W=1120,H=790,CX=560,CY=392,RM=166,RK=336;
    const id='kg'+(++uid);

    /* 上图知识点（key）在圆周上均匀分布，避免同模块节点重叠 */
    const kpList=[];
    MODULES.forEach(m=>m.points.filter(p=>p.key).forEach(p=>kpList.push({...p,m})));
    const N=kpList.length,stepDeg=360/N;
    kpList.forEach((k,i)=>{
      k.deg=i*stepDeg;
      const [x,y]=polar(CX,CY,RK,k.deg);
      k.x=x;k.y=y;
    });

    /* 模块节点按课程顺序均匀分布，与知识点形成两层环 */
    const mods=MODULES.map((m,i)=>{
      const deg=i*(360/MODULES.length);
      const [x,y]=polar(CX,CY,RM,deg);
      return {...m,x,y,deg};
    });

    const modById={};mods.forEach(m=>modById[m.id]=m);
    const edges=kpList.map(k=>({x1:modById[k.m.id].x,y1:modById[k.m.id].y,x2:k.x,y2:k.y,color:k.m.accent,id:k.id,mod:k.m.id}));
    const byId={};kpList.forEach(k=>byId[k.id]=k);
    const depEdges=LINKS.map(([a,b])=>{const A=byId[a],B=byId[b];if(!A||!B)return '';const cx=((A.x+B.x)/2+CX)/2,cy=((A.y+B.y)/2+CY)/2;return `<path class="kg-dep" d="M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}" data-from="${a}" data-to="${b}"/>`}).join('');

    let s=`<svg class="kg-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="数字电子时钟课程知识图谱">`;
    s+=`<defs>
      <radialGradient id="${id}bg" cx="50%" cy="50%" r="62%">
        <stop offset="0%" stop-color="#16394d"/><stop offset="58%" stop-color="#0e2534"/><stop offset="100%" stop-color="#08161f"/>
      </radialGradient>
      <filter id="${id}glow" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="${id}soft" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="${id}core" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffd479"/><stop offset="100%" stop-color="#e08a1e"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#${id}bg)"/>`;

    [RM+58,RK-50].forEach((r,i)=>{
      s+=`<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#2a5468" stroke-width="1" stroke-dasharray="${i?'3 7':'6 10'}" opacity=".55"/>`;
    });

    edges.forEach(e=>{
      s+=`<line class="kg-edge" x1="${e.x1.toFixed(1)}" y1="${e.y1.toFixed(1)}" x2="${e.x2.toFixed(1)}" y2="${e.y2.toFixed(1)}" stroke="${e.color}" stroke-width="1.8" opacity=".52" data-node="${e.id}" data-mod="${e.mod}"/>`;
    });
    s+=depEdges;

    s+=`<g class="kg-center" data-id="CORE" data-type="core">
      <circle class="kg-pulse" cx="${CX}" cy="${CY}" r="70" fill="none" stroke="#f0c060" stroke-width="1.2" opacity=".5"/>
      <circle cx="${CX}" cy="${CY}" r="62" fill="url(#${id}core)" filter="url(#${id}glow)" opacity=".95"/>
      <text x="${CX}" y="${CY-6}" text-anchor="middle" font-size="17" font-weight="800" fill="#1b1206">数字电子时钟</text>
      <text x="${CX}" y="${CY+14}" text-anchor="middle" font-size="11" fill="#4a3407">贯穿项目 · ${STAT.points} 个知识点</text>
      <text x="${CX}" y="${CY+32}" text-anchor="middle" font-size="10" fill="#6b4f10">点击节点查看详情</text>
    </g>`;

    mods.forEach(m=>{
      s+=`<g class="kg-node kg-mod" data-id="${m.id}" data-type="module" data-mod="${m.id}">
        <rect x="${(m.x-70).toFixed(1)}" y="${(m.y-21).toFixed(1)}" width="140" height="42" rx="11" fill="#0d2634" stroke="${m.accent}" stroke-width="1.8" filter="url(#${id}soft)"/>
        <circle cx="${(m.x-52).toFixed(1)}" cy="${(m.y-6).toFixed(1)}" r="4" fill="${m.accent}"/>
        <text x="${(m.x+4).toFixed(1)}" y="${(m.y-2).toFixed(1)}" text-anchor="middle" font-size="13.5" font-weight="800" fill="#e6f3f7">${esc(m.name)}</text>
        <text x="${(m.x+4).toFixed(1)}" y="${(m.y+14).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${m.accent}">${esc(m.code)} · ${m.points.length} 个知识点</text>
      </g>`;
    });

    kpList.forEach((k,i)=>{
      const w=106,h=38;
      s+=`<g class="kg-node kg-kp" data-id="${k.id}" data-type="point" data-mod="${k.m.id}" style="--d:${(i*38+120)}ms">
        <rect x="${(k.x-w/2).toFixed(1)}" y="${(k.y-h/2).toFixed(1)}" width="${w}" height="${h}" rx="10" fill="#0a1f2b" stroke="${k.m.accent}" stroke-width="1.4"/>
        <rect x="${(k.x-w/2).toFixed(1)}" y="${(k.y-h/2).toFixed(1)}" width="3.5" height="${h}" rx="2" fill="${k.m.accent}"/>
        <text x="${k.x.toFixed(1)}" y="${(k.y-1).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#dcecf2">${esc(k.short)}</text>
        <text x="${k.x.toFixed(1)}" y="${(k.y+13).toFixed(1)}" text-anchor="middle" font-size="9" fill="#7ea3b3">${esc(k.code)}${k.card?' · '+k.card:''}</text>
      </g>`;
    });

    s+=`</svg>`;
    return {
      svg:s,
      legend:MODULES.map(m=>`<span class="kg-lg"><i style="background:${m.accent}"></i>${esc(m.name)}</span>`).join('')+
             '<span class="kg-lg"><i class="dash"></i>先修关系</span>'
    };
  }

  /* ============================ 视图二：能力与评价 ============================ */
  function viewAbility(){
    let s='<div class="kg-chain">';
    ABILITY.forEach((a,i)=>{
      s+=`<button class="kg-step${i===0?' on':''}" data-ability="${a.id}">
        <span class="kg-step-no">${i+1}</span>
        <b>${esc(a.name)}</b>
        <small>${esc(a.stage)}</small>
      </button>`;
      if(i<ABILITY.length-1)s+='<span class="kg-arrow">→</span>';
    });
    s+='</div><div class="kg-split"><div id="kg-ability-detail" class="kg-detail"></div>'+
       '<div class="kg-evidence"><h4>过程证据与评价</h4>'+EVIDENCE.map(e=>
         `<div class="kg-ev" data-link="${e.link}"><b>${esc(e.name)}</b><small>${esc(e.detail)}</small></div>`).join('')+
       '<div class="kg-weight"><span>平时 50%</span><span>报告 30%</span><span>实践 20%</span></div>'+
       '<p class="kg-note">正式成绩仍以 Multisim 源文件、实测波形、报告和答辩为准；结构评分只用于定位证据缺口。</p></div></div>';
    return s;
  }

  /* ============================ 视图三：故障诊断链 ============================ */
  function viewFault(){
    let s='<div class="kg-faults">';
    FAULTS.forEach((f,i)=>{
      s+=`<button class="kg-fault${i===0?' on':''}" data-fault="${f.key}">
        <span>${String(i+1).padStart(2,'0')}</span><b>${esc(f.label)}</b><small>${esc(f.card)}</small></button>`;
    });
    s+='</div><div id="kg-fault-detail" class="kg-detail"></div>';
    return s;
  }

  /* ============================ 详情渲染 ============================ */
  function coreDetail(){
    return `<h4>数字电子时钟 · 课程知识图谱</h4>
      <p>本图谱把课程拆成 <b>${STAT.modules} 个功能模块、${STAT.points} 个知识点</b>，并标出 ${STAT.links} 条先修/信号依赖关系。
      主链是“时基 → 计数 → 译码显示”，两条支线是“进位与回零”“调时与去抖”，最后回到“拓展与稳定”。</p>
      <div class="kg-stats">
        <span><b>${STAT.modules}</b>功能模块</span><span><b>${STAT.points}</b>知识点</span>
        <span><b>${STAT.links}</b>先修关系</span><span><b>${STAT.cards}</b>诊断知识卡</span><span><b>${STAT.chapters}</b>实验章节</span>
      </div>
      <p class="kg-note">点击模块查看它的全部知识点，点击知识点查看原理、公式、常见错误与测点。</p>`;
  }

  function moduleDetail(m){
    return `<h4><i style="background:${m.accent}"></i>${esc(m.name)}　<span class="kg-tag">${esc(m.code)} · ${m.hours}</span></h4>
      <p>${esc(m.desc)}</p>
      <div class="kg-list">${m.points.map(p=>
        `<button class="kg-item" data-point="${p.id}">
           <b>${esc(p.name)}</b>
           <small>${esc(p.code)}${p.card?' · 知识卡 '+p.card:''}${p.key?' · 已上图':''}</small>
         </button>`).join('')}</div>`;
  }

  function pointDetail(k){
    return `<h4>${esc(k.name)}</h4>
      <div class="kg-meta">
        <span class="kg-tag" style="border-color:${k.color};color:${k.color}">${esc(k.m.name)}</span>
        <span class="kg-tag">${esc(k.code)}</span>
        ${k.card?`<button class="kg-card-link" data-card="${k.card}">关联知识卡 ${k.card}</button>`:''}
      </div>
      <h5>原理</h5><p>${esc(k.principle)}</p>
      ${k.formula?`<h5>公式与参数</h5><div class="kg-formula">${esc(k.formula)}</div>`:''}
      <h5>常见错误</h5><ul>${k.mistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      <h5>测点与证据</h5><ul class="kg-probe">${k.probes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  }

  function abilityDetail(a){
    return `<h4>${esc(a.name)}　<span class="kg-tag">${esc(a.stage)}</span></h4>
      <p>${esc(a.desc)}</p>
      <h5>对应任务</h5><p>${esc(a.task)}</p>
      <h5>提交证据</h5><p>${esc(a.evidence)}</p>
      <h5>评价要点</h5><div class="kg-formula">${esc(a.rubric)}</div>`;
  }

  function faultDetail(f){
    const k=findPoint(f.chain);
    return `<h4>${esc(f.label)}</h4>
      <div class="kg-meta"><span class="kg-tag">关联知识卡 ${esc(f.card)}</span></div>
      <h5>排查顺序</h5><ol class="kg-probe">${f.step.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
      <h5>关键测点</h5><ul>${f.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      ${k?`<h5>对应知识点</h5><button class="kg-item" data-point="${k.id}"><b>${esc(k.name)}</b><small>${esc(k.code)} · 点击查看原理与测点</small></button>`:''}`;
  }

  function findPoint(id){
    for(const m of MODULES){const p=m.points.find(x=>x.id===id);if(p)return {...p,m};}
    return null;
  }

  /* ============================ 挂载与交互 ============================ */
  const VIEWS=[{id:'graph',name:'知识图谱'},{id:'ability',name:'能力与评价'},{id:'fault',name:'故障诊断链'}];

  function render(mount,opts){
    if(!mount)return;
    opts=opts||{};
    const S={view:opts.view||'graph',sel:'CORE',ability:'A1',fault:FAULTS[0].key};
    const g=viewGraph();

    mount.innerHTML=
      '<div class="kg-bar">'+
        '<div class="kg-tabs">'+VIEWS.map(v=>`<button class="kg-tab${v.id===S.view?' on':''}" data-view="${v.id}">${v.name}</button>`).join('')+'</div>'+
        '<div class="kg-hint">'+STAT.modules+' 模块 · '+STAT.points+' 知识点 · '+STAT.links+' 条先修关系</div>'+
      '</div>'+
      '<div class="kg-stage" data-view="'+S.view+'">'+
        '<div class="kg-canvas">'+g.svg+'<div class="kg-legend">'+g.legend+'</div></div>'+
      '</div>'+
      '<div id="kg-side" class="kg-side"></div>';

    const stage=mount.querySelector('.kg-stage');
    const side=mount.querySelector('#kg-side');

    function paint(){
      stage.setAttribute('data-view',S.view);
      mount.querySelectorAll('.kg-tab').forEach(b=>b.classList.toggle('on',b.dataset.view===S.view));
      stage.innerHTML=S.view==='graph'
        ? '<div class="kg-canvas">'+g.svg+'<div class="kg-legend">'+g.legend+'</div></div>'
        : (S.view==='ability'?viewAbility():viewFault());
      side.style.display=S.view==='graph'?'':'none';
      if(S.view==='ability'){
        side.style.display='none';
        const d=stage.querySelector('#kg-ability-detail');
        if(d)d.innerHTML=abilityDetail(ABILITY[0]);
      }
      if(S.view==='fault'){
        side.style.display='none';
        const d=stage.querySelector('#kg-fault-detail');
        if(d)d.innerHTML=faultDetail(FAULTS[0]);
      }
      bindStage();
    }

    function showSide(html){side.innerHTML=html;side.classList.add('on');}

    function bindStage(){
      if(S.view==='graph'){
        const svg=stage.querySelector('.kg-svg');
        if(!svg)return;
        svg.querySelectorAll('.kg-node').forEach(node=>{
          node.addEventListener('click',()=>{
            const id=node.dataset.id,type=node.dataset.type;
            S.sel=id;
            if(type==='core')showSide(coreDetail());
            else if(type==='module'){const m=MODULES.find(x=>x.id===id);showSide(m?moduleDetail(m):coreDetail());}
            else {const k=findPoint(id);showSide(k?pointDetail(k):coreDetail());}
            focus(node.dataset.mod);
          });
          node.addEventListener('mouseenter',()=>hover(node.dataset.id,node.dataset.mod));
          node.addEventListener('mouseleave',()=>hover(null,null));
        });
      }else if(S.view==='ability'){
        stage.querySelectorAll('[data-ability]').forEach(b=>b.onclick=()=>{
          stage.querySelectorAll('[data-ability]').forEach(x=>x.classList.toggle('on',x===b));
          const d=stage.querySelector('#kg-ability-detail');
          const a=ABILITY.find(x=>x.id===b.dataset.ability);
          if(d&&a)d.innerHTML=abilityDetail(a);
        });
        stage.querySelectorAll('[data-link]').forEach(el=>el.onclick=()=>{
          const link=el.dataset.link;
          const a=ABILITY.find(x=>x.id==='A'+link.slice(1));
          if(a){
            stage.querySelectorAll('[data-ability]').forEach(x=>x.classList.toggle('on',x.dataset.ability===a.id));
            const d=stage.querySelector('#kg-ability-detail');
            if(d)d.innerHTML=abilityDetail(a);
          }
          side.style.display='';
          const k=findPoint(link);
          if(k)showSide(pointDetail(k));
        });
      }else{
        stage.querySelectorAll('[data-fault]').forEach(b=>b.onclick=()=>{
          stage.querySelectorAll('[data-fault]').forEach(x=>x.classList.toggle('on',x===b));
          const d=stage.querySelector('#kg-fault-detail');
          const f=FAULTS.find(x=>x.key===b.dataset.fault);
          if(d&&f)d.innerHTML=faultDetail(f);
        });
      }
      side.querySelectorAll('[data-point]').forEach(b=>b.onclick=()=>{
        const k=findPoint(b.dataset.point);
        if(k)showSide(pointDetail(k));
      });
      side.querySelectorAll('.kg-card-link').forEach(b=>b.onclick=()=>{
        document.dispatchEvent(new CustomEvent('kg:openCard',{detail:{card:b.dataset.card}}));
      });
    }

    function focus(modId){
      const svg=stage.querySelector('.kg-svg');
      if(!svg)return;
      svg.querySelectorAll('.kg-node').forEach(n=>{
        const on=!modId||n.dataset.mod===modId||n.dataset.type==='module'&&n.dataset.id===modId||n.dataset.type==='core';
        n.classList.toggle('dim',!on);
        n.classList.toggle('sel',n.dataset.id===S.sel);
      });
      svg.querySelectorAll('.kg-edge').forEach(e=>{
        const on=!modId||e.dataset.mod===modId;
        e.setAttribute('opacity',on?'0.62':'0.1');
      });
      svg.querySelectorAll('.kg-dep').forEach(e=>{
        const on=!modId||pointMod(e.dataset.from)===modId||pointMod(e.dataset.to)===modId;
        e.classList.toggle('on',on);
        e.style.opacity=on?'':'0.06';
      });
    }

    function hover(id,modId){
      const svg=stage.querySelector('.kg-svg');
      if(!svg)return;
      if(!id){focus(S.sel==='CORE'?null:currentMod());return;}
      svg.querySelectorAll('.kg-node').forEach(n=>{
        const relate=n.dataset.id===id||n.dataset.mod===modId;
        n.classList.toggle('hi',relate);
        n.classList.toggle('dim',!relate);
      });
      svg.querySelectorAll('.kg-dep').forEach(e=>{
        const hit=e.dataset.from===id||e.dataset.to===id;
        e.classList.toggle('on',hit);
        e.style.opacity=hit?'1':'0.06';
      });
    }

    function pointMod(pid){const k=findPoint(pid);return k?k.m.id:'';}
    function currentMod(){if(S.sel==='CORE')return '';const k=findPoint(S.sel);return k?k.m.id:S.sel;}

    mount.querySelectorAll('.kg-tab').forEach(b=>b.onclick=()=>{
      S.view=b.dataset.view;
      paint();
    });

    paint();
    showSide(coreDetail());
  }

  window.COURSE_GRAPH={render:render,data:{MODULES:MODULES,LINKS:LINKS,ABILITY:ABILITY,EVIDENCE:EVIDENCE,FAULTS:FAULTS,STAT:STAT}};
})();
