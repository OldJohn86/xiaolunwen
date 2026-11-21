/* 原型演示数据
 * 注意：
 * 1. 以下论文元数据仅用于交互演示，上线前必须逐篇核对原文与许可证。
 * 2. 解读内容为示例性科普文本，不是官方结论；演示中标注了"原文出处"的位置为示意。
 * 3. license.deep 仅作为前端展示提示；真实准入由 tools/license-check 校验。
 * 4. 摘要为平台整理/改写，不是逐句翻译；全文翻译需按许可证另行取得授权。
 */
const DATA = {
  papers: [
    {
      id: "einstein-1905",
      titleZh: "关于光的产生与转化的一个启发性观点",
      titleEn: "On a Heuristic Point of View Concerning the Production and Transformation of Light",
      authors: "Albert Einstein",
      journal: "Annalen der Physik",
      year: 1905,
      citations: 15800,
      field: "物理",
      nobel: "1921 年诺贝尔物理学奖",
      tag: "demo",
      license: {
        spdx: "PUBLIC-DOMAIN",
        code: "公有领域",
        note: "发表于 1905 年，著作权已进入公有领域",
        deep: true,
        commercial: true,
        derivatives: true
      },
      abstractZh: "论文提出光由离散的能量子组成，每个能量子的能量与频率成正比。用这一假说解释光电效应：电子逸出金属表面的最大动能只取决于入射光频率，而与光强无关。该假说突破了经典波动理论的解释边界。",
      abstractEn: "The paper proposes that light consists of discrete energy quanta whose energy is proportional to frequency. It explains the photoelectric effect: the maximum kinetic energy of emitted electrons depends only on the frequency of the incident light, not its intensity.",
      formula: "hν = Eₖ + W",
      interpretation: [
        { key: "hypothesis", label: "研究假设", text: "光本身由能量子（光子）组成，单个光子能量 E = hν；光电效应中电子能否逸出、逸出后动能多大，取决于光的频率，而非光强。", ref: "§1 引言" },
        { key: "design", label: "实验设计", text: "用不同频率、不同强度的单色光照射金属表面，测量截止电压与光电流；通过截止电压反推逸出电子的最大动能，并比较频率与强度的独立影响。", ref: "§2 实验装置" },
        { key: "result", label: "核心结论", text: "最大动能随频率线性增加、与光强无关；直线斜率对应普朗克常量 h，截距对应材料的逸出功 W。这为光量子假说提供了定量支持。", ref: "§3 结果" },
        { key: "limitation", label: "研究局限", text: "受当时实验精度限制，未直接观测单个光子；金属表面状态与逸出功测量存在不确定性；结论依赖理想化金属表面假设。", ref: "§4 讨论" },
        { key: "controversy", label: "学界争议", text: "论文与当时主流的波动理论直接冲突，初期接受度有限；此后康普顿散射等独立实验支持光量子图像，密立根 1913 年的精密测量进一步验证了定量关系。", ref: "§5 与后续工作" }
      ],
      demo: {
        title: "紫外灯照射锌板：验电器为什么会放电？",
        note: "可用紫外灯、锌板与验电器做课堂级简化演示。演示只展示定性现象，不等同于论文的定量实验。",
        available: true
      },
      thinking: [
        "为什么单纯提高光强，不能增加单个逸出电子的最大动能？",
        "如果把金属换成半导体材料，频率与动能的关系会如何变化？",
        "这条结论的成立依赖哪些前提？在什么条件下需要修正？"
      ],
      link: "https://doi.org/10.1002/andp.19053220607"
    },
    {
      id: "ligo-2016",
      titleZh: "引力波的直接探测",
      titleEn: "Observation of Gravitational Waves from a Binary Black Hole Merger",
      authors: "LIGO Scientific Collaboration and Virgo Collaboration",
      journal: "Physical Review Letters",
      year: 2016,
      citations: 12000,
      field: "天文",
      nobel: "2017 年诺贝尔物理学奖",
      tag: "logic",
      license: {
        spdx: "CC-BY-3.0",
        code: "CC BY 3.0",
        note: "开放获取，允许署名后传播与演绎",
        deep: true,
        commercial: true,
        derivatives: true
      },
      abstractZh: "2015 年 9 月 14 日，两台 LIGO 激光干涉仪同时探测到引力波信号 GW150914。信号特征与约 13 亿光年外两个黑洞并合的广义相对论预言一致，这是人类首次直接探测到引力波。",
      abstractEn: "On September 14, 2015, the two LIGO detectors simultaneously observed a gravitational-wave signal, GW150914. Its properties match the general-relativistic prediction for the merger of two black holes roughly 1.3 billion light-years away.",
      formula: "h ≈ ΔL / L ~ 10⁻²¹",
      interpretation: [
        { key: "hypothesis", label: "研究假设", text: "广义相对论预言加速运动的质量会产生时空涟漪；两个致密天体并合应产生频率与振幅随时间演化的引力波，可在地球上以微小应变的形式被探测。", ref: "§I 引言" },
        { key: "design", label: "实验设计", text: "使用两台相距约 3000 公里的 4 公里臂长激光干涉仪同时观测，要求信号在两端符合预期的时间延迟与波形；通过多种独立数据分析管道比对，并排除本地扰动与仪器伪影。", ref: "§II 探测器与方法" },
        { key: "result", label: "核心结论", text: "探测到峰值应变约 1.0×10⁻²¹ 的信号，与约 36 和 29 倍太阳质量双黑洞并合的模板高度一致；信号与早先脉冲星双星轨道衰减的间接证据相互印证。", ref: "§IV 结果" },
        { key: "limitation", label: "研究局限", text: "单事件统计有限，质量与距离估计依赖波形模板和天体物理先验；极端质量比、高速自旋等情形仍需更多事件检验。", ref: "§V 讨论" },
        { key: "controversy", label: "学界争议", text: "该发现本身已被广泛接受，但数据分析管道的独立复现、噪声建模与后续事件目录的一致性仍是持续检验的重点。", ref: "§VI 后续" }
      ],
      demo: {
        title: "为什么 4 公里的干涉臂能测到比原子核还小的变化？",
        note: "完整探测无法简易复现。可用桌面干涉仪演示干涉条纹对光程差的敏感，但这不是引力波探测的等价实验。",
        available: false
      },
      thinking: [
        "两台探测器同时观测，能排除哪些类型的误报？还需要哪些独立证据？",
        "为什么信号强度如此微弱，却仍能被确认不是噪声？",
        "如果只改变黑洞质量，波形会怎样变化？"
      ],
      link: "https://doi.org/10.1103/PhysRevLett.116.061102"
    },
    {
      id: "alphafold-2021",
      titleZh: "基于深度学习的蛋白质结构高精度预测",
      titleEn: "Highly Accurate Protein Structure Prediction with AlphaFold",
      authors: "John Jumper, Richard Evans, Alexander Pritzel, et al.",
      journal: "Nature",
      year: 2021,
      citations: 30000,
      field: "计算机",
      nobel: "2024 年诺贝尔化学奖（相关成果）",
      tag: "logic",
      license: {
        spdx: "CC-BY-4.0",
        code: "CC BY 4.0",
        note: "开放获取，允许署名后传播与演绎",
        deep: true,
        commercial: true,
        derivatives: true
      },
      abstractZh: "AlphaFold2 在 CASP14 盲测中实现了接近实验精度的蛋白质三维结构预测。模型仅依赖氨基酸序列与多序列比对信息，通过端到端深度学习输出原子坐标，为结构生物学提供了新的研究工具。",
      abstractEn: "AlphaFold2 achieved protein structure predictions of remarkable accuracy in the CASP14 blind assessment. The model predicts atomic coordinates directly from sequence and multiple sequence alignment information.",
      formula: "sequence → 3D structure",
      interpretation: [
        { key: "hypothesis", label: "研究假设", text: "蛋白质的三维结构信息编码在氨基酸序列与进化同源信息中，可由端到端深度学习模型直接预测。", ref: "摘要与引言" },
        { key: "design", label: "实验设计", text: "以 PDB 实验结构为训练数据，结合注意力机制与几何约束构建网络；在 CASP14 盲测中对未公开结构进行预测，并与实验解析结果比较。", ref: "方法" },
        { key: "result", label: "核心结论", text: "多数目标的中位 GDT 分数约 92，接近实验精度；模型对整体折叠的判断显著优于此前方法。", ref: "结果" },
        { key: "limitation", label: "研究局限", text: "训练数据偏向已知结构家族，对稀有折叠、柔性构象与配体复合物仍有困难；预测结果不能替代实验验证，静态结构也不能完整描述动态过程。", ref: "讨论" },
        { key: "controversy", label: "学界争议", text: "预测精度已获广泛认可，但其对药物发现的实际增益、模型在分布外数据上的可靠性，以及开源与商业化边界仍在讨论中。", ref: "讨论与后续" }
      ],
      demo: {
        title: "从序列到结构：预测可视化",
        note: "可做简化动画展示氨基酸链如何折叠成结构，但动画是示意，不是模型真实计算过程。",
        available: false
      },
      thinking: [
        "盲测评估为什么比在训练集上测试更有说服力？",
        "预测结构达到实验精度，是否意味着不再需要实验？",
        "模型在哪些类型的蛋白质上可能失效？"
      ],
      link: "https://doi.org/10.1038/s41586-021-03819-2"
    },
    {
      id: "lk99-2023",
      titleZh: "铜掺杂铅磷灰石（LK-99）的室温超导声称",
      titleEn: "The Room-Temperature Ambient-Pressure Superconductivity Claim of Cu-Doped Lead Apatite (LK-99)",
      authors: "Sukbae Lee, Ji-Hoon Kim, et al.（预印本）",
      journal: "arXiv 预印本",
      year: 2023,
      citations: 900,
      field: "物理",
      nobel: null,
      tag: "controversy",
      license: {
        spdx: "ARXIV-NONEXCLUSIVE",
        code: "预印本（仅原文）",
        note: "未经同行评审；平台仅做争议梳理，不对真伪作判定",
        deep: true,
        commercial: false,
        derivatives: false
      },
      abstractZh: "2023 年，两组作者发布预印本，声称铜掺杂铅磷灰石（LK-99）在室温常压下表现超导特征。报告给出电阻随温度骤降及疑似磁悬浮现象。该声称随后引发全球多组复现尝试，但多数未观察到室温超导。",
      abstractEn: "In 2023, preprints claimed that Cu-doped lead apatite (LK-99) exhibits superconductivity at room temperature and ambient pressure, reporting sharp resistance drops and partial levitation. Multiple replication attempts followed, most of which did not observe room-temperature superconductivity.",
      formula: "Pb₁₀₋ₓCuₓ(PO₄)₆O",
      interpretation: [
        { key: "hypothesis", label: "研究假设", text: "铜掺杂的铅磷灰石结构可能在室温、常压下实现超导，且制备条件相对简单。", ref: "预印本摘要" },
        { key: "design", label: "实验设计", text: "合成多批样品，测量电阻随温度的变化、磁化特性，并展示样品在磁体上的部分悬浮现象。", ref: "预印本方法" },
        { key: "result", label: "作者报告", text: "原始预印本报告电阻在约 400 K 以下急剧下降，并观察到疑似迈斯纳效应与部分悬浮。", ref: "预印本结果" },
        { key: "limitation", label: "证据局限", text: "样品纯度、均匀性与测量伪影受到质疑；电阻骤降可能来自杂质相或接触问题；部分悬浮也可能由其他磁性/抗磁效应导致。", ref: "后续评论与复现报告" },
        { key: "controversy", label: "学界争议", text: "多国实验室的复现未能观察到室温超导；主流观点认为现有证据不足。原始预印本未经同行评审。平台仅并列呈现多方证据，不判定真伪。", ref: "综述与复现汇总" }
      ],
      demo: {
        title: "争议案例：如何判断一个超导声称？",
        note: "本内容属于【学界存在争议】案例，用于训练证据判断，不代表平台对论文真伪作出结论。",
        available: false
      },
      thinking: [
        "判断超导需要哪些独立证据？只凭电阻下降足够吗？",
        "为什么“部分悬浮”不能单独证明室温超导？",
        "预印本未经同行评审，阅读时应如何调整证据权重？"
      ],
      link: "https://arxiv.org/abs/2307.12008"
    },
    {
      id: "watson-crick-1953",
      titleZh: "核酸的分子结构——DNA 双螺旋模型",
      titleEn: "Molecular Structure of Nucleic Acids: A Structure for Deoxyribose Nucleic Acid",
      authors: "J. D. Watson, F. H. C. Crick",
      journal: "Nature",
      year: 1953,
      citations: 25000,
      field: "生物",
      nobel: "1962 年诺贝尔生理学或医学奖",
      tag: "logic",
      license: {
        spdx: "PROPRIETARY-ABSTRACT-ONLY",
        code: "仅摘要",
        note: "受出版社版权限制，原型仅展示元数据与摘要",
        deep: false,
        commercial: false,
        derivatives: false
      },
      abstractZh: "论文提出 DNA 的双螺旋结构模型：两条多核苷酸链以相反方向缠绕，碱基对位于内侧，通过氢键配对。该模型为遗传信息的复制与传递提供了结构基础。",
      abstractEn: "The paper proposes a double-helical structure for DNA, with two polynucleotide chains wound in opposite directions and base pairs on the inside. The model provided a structural basis for genetic information storage and replication.",
      formula: "A–T / G–C",
      interpretation: null,
      demo: null,
      thinking: [
        "模型如何解释碱基配对的特异性？",
        "哪些实验证据支持双螺旋结构？",
        "该模型还有哪些当时未能解释的问题？"
      ],
      link: "https://doi.org/10.1038/171737a0"
    },
    {
      id: "penzias-wilson-1965",
      titleZh: "一种天线多余温度的测量",
      titleEn: "A Measurement of Excess Antenna Temperature at 4080 Mc/s",
      authors: "A. A. Penzias, R. W. Wilson",
      journal: "The Astrophysical Journal",
      year: 1965,
      citations: 8000,
      field: "天文",
      nobel: "1978 年诺贝尔物理学奖",
      tag: "logic",
      license: {
        spdx: "PROPRIETARY-ABSTRACT-ONLY",
        code: "仅摘要",
        note: "受出版社版权限制，原型仅展示元数据与摘要",
        deep: false,
        commercial: false,
        derivatives: false
      },
      abstractZh: "作者在 4080 MHz 处测量到约 3.5 K 的多余天线温度，且该信号在天空中近似各向同性。这一多余噪声后被解释为宇宙微波背景辐射，成为大爆炸理论的关键证据。",
      abstractEn: "The authors measured an excess antenna temperature of about 3.5 K at 4080 MHz, approximately isotropic across the sky. This excess was later interpreted as the cosmic microwave background, a key evidence for the Big Bang.",
      formula: "T ≈ 3.5 K",
      interpretation: null,
      demo: null,
      thinking: [
        "为什么要强调信号在天空中各向同性？",
        "如果多余噪声来自仪器或地面干扰，会呈现什么特征？",
        "这一测量与理论预言如何相互印证？"
      ],
      link: "https://doi.org/10.1086/148307"
    },
    {
      id: "tu-1977",
      originalLang: "zh",
      titleZh: "一种新型倍半萜内酯——青蒿素",
      titleEn: "A New Sesquiterpene Lactone: Artemisinin",
      authors: "青蒿素结构研究协作组",
      journal: "科学通报",
      year: 1977,
      citations: 4200,
      field: "医学",
      nobel: "2015 年诺贝尔生理学或医学奖（相关成果）",
      tag: "logic",
      license: {
        spdx: "PROPRIETARY-ABSTRACT-ONLY",
        code: "仅摘要",
        note: "受期刊版权限制，原型仅展示元数据与摘要",
        deep: false,
        commercial: false,
        derivatives: false
      },
      abstractZh: "论文报告从黄花蒿中分离得到一种新型倍半萜内酯——青蒿素，并解析其结构。青蒿素及其衍生物成为抗疟治疗的重要药物，为全球疟疾防控作出重要贡献。",
      abstractEn: "The paper reports the isolation and structural elucidation of a new sesquiterpene lactone, artemisinin, from Artemisia annua. Artemisinin and its derivatives became important antimalarial drugs.",
      formula: "C₁₅H₂₂O₅",
      interpretation: null,
      demo: null,
      thinking: [
        "传统药物筛选与现代结构解析如何结合？",
        "结构解析对新药研发意味着什么？",
        "抗疟药物为何需要联合用药？"
      ],
      link: "https://doi.org/10.1360/csb1977-22-3-142"
    },
    {
      id: "doudna-2012",
      titleZh: "一种由双 RNA 引导的 DNA 内切酶及其在细菌适应性免疫中的作用",
      titleEn: "A Programmable Dual-RNA-Guided DNA Endonuclease in Adaptive Bacterial Immunity",
      authors: "Martin Jinek, Krzysztof Chylinski, Ines Fonfara, Michael Hauer, Jennifer A. Doudna, Emmanuelle Charpentier",
      journal: "Science",
      year: 2012,
      citations: 20000,
      field: "生物",
      nobel: "2020 年诺贝尔化学奖",
      tag: "logic",
      license: {
        spdx: "PROPRIETARY-ABSTRACT-ONLY",
        code: "仅摘要",
        note: "受出版社版权限制，原型仅展示元数据与摘要",
        deep: false,
        commercial: false,
        derivatives: false
      },
      abstractZh: "研究发现 Cas9 核酸酶可由双 RNA 引导，在特定位点切割 DNA。该机制来自细菌适应性免疫系统，并为可编程的基因组编辑提供了基础。",
      abstractEn: "The study shows that the Cas9 endonuclease can be guided by dual RNAs to cleave DNA at specific sites, providing the basis for programmable genome editing.",
      formula: "sgRNA + Cas9 → cut",
      interpretation: null,
      demo: null,
      thinking: [
        "为什么“可编程”是这项技术的关键？",
        "细菌免疫系统与基因编辑工具之间是什么关系？",
        "基因编辑技术的伦理边界应如何讨论？"
      ],
      link: "https://doi.org/10.1126/science.1225829"
    },
    {
      id: "higgs-1964",
      titleZh: "破缺对称性与规范玻色子的质量",
      titleEn: "Broken Symmetries and the Masses of Gauge Bosons",
      authors: "Peter W. Higgs",
      journal: "Physical Review Letters",
      year: 1964,
      citations: 9000,
      field: "物理",
      nobel: "2013 年诺贝尔物理学奖",
      tag: "logic",
      license: {
        spdx: "PROPRIETARY-ABSTRACT-ONLY",
        code: "仅摘要",
        note: "受出版社版权限制，原型仅展示元数据与摘要",
        deep: false,
        commercial: false,
        derivatives: false
      },
      abstractZh: "论文提出通过自发对称性破缺机制，使规范玻色子获得质量，同时保持理论的自洽性。该机制预言的粒子后在大型强子对撞机上被发现。",
      abstractEn: "The paper proposes that gauge bosons acquire mass through spontaneous symmetry breaking while preserving the consistency of the theory. The predicted particle was later discovered at the Large Hadron Collider.",
      formula: "SU(2) × U(1) → U(1)",
      interpretation: null,
      demo: null,
      thinking: [
        "为什么规范玻色子的质量是个理论难题？",
        "自发对称性破缺与显式破缺有何区别？",
        "理论预言如何被实验检验？"
      ],
      link: "https://doi.org/10.1103/PhysRevLett.13.508"
    }
  ],

  concepts: [
    { id: "falsifiability", name: "可证伪性", en: "Falsifiability", definition: "一个科学主张应当能指出在什么观测结果下它会被推翻。不能被任何证据否定的说法，不属于可检验的科学命题。", papers: ["higgs-1964", "lk99-2023"] },
    { id: "peer-review", name: "同行评审", en: "Peer Review", definition: "由同领域研究者对论文方法、证据与结论进行独立评议。它降低错误率，但不等于结论一定正确。", papers: ["lk99-2023", "watson-crick-1953"] },
    { id: "preprint", name: "预印本", en: "Preprint", definition: "未经同行评审即公开的论文版本，便于快速交流，但证据强度需谨慎评估。", papers: ["lk99-2023"] },
    { id: "control", name: "实验对照", en: "Control", definition: "通过设置比较条件，把干预效应与其他因素分离开。没有对照，就很难把观测变化归因于单一变量。", papers: ["einstein-1905", "ligo-2016"] },
    { id: "blind-test", name: "盲测评估", en: "Blind Assessment", definition: "在不知道答案的情况下评估方法表现，避免研究者无意中向结果靠拢。", papers: ["alphafold-2021"] },
    { id: "replication", name: "独立复现", en: "Replication", definition: "由独立团队用独立数据重复实验。复现失败不必然说明原研究造假，但会削弱结论的可靠性。", papers: ["lk99-2023", "ligo-2016"] },
    { id: "uncertainty", name: "误差与置信", en: "Uncertainty", definition: "测量结果总伴随误差。报告结论时应给出不确定度或置信区间，而不是只给一个点值。", papers: ["ligo-2016", "penzias-wilson-1965"] },
    { id: "scope", name: "适用范围", en: "Scope", definition: "结论成立的条件边界：样本、环境、剂量、时间尺度。超出范围外推，是科普失真的常见来源。", papers: ["alphafold-2021", "einstein-1905"] },
    { id: "model-evidence", name: "模型与证据", en: "Model vs. Evidence", definition: "模型是对现实的简化。模型与数据一致，不等于模型唯一正确；需要独立证据交叉验证。", papers: ["higgs-1964", "ligo-2016"] },
    { id: "consensus", name: "科学共识", en: "Scientific Consensus", definition: "在大量独立证据基础上形成的暂时性判断，会随新证据修正，而不是投票或权威裁定。", papers: ["lk99-2023", "doudna-2012"] }
  ],

  topics: [
    { id: "nobel", name: "诺奖溯源计划", desc: "从原始论文出发，重走里程碑发现的论证过程。", papers: ["einstein-1905", "ligo-2016", "watson-crick-1953", "penzias-wilson-1965", "tu-1977", "doudna-2012", "higgs-1964"], tone: "amber" },
    { id: "quantum", name: "量子革命", desc: "光量子、对称性破缺与标准模型的建立。", papers: ["einstein-1905", "higgs-1964", "lk99-2023"], tone: "ink" },
    { id: "life", name: "生命密码", desc: "从双螺旋到可编程基因编辑。", papers: ["watson-crick-1953", "doudna-2012", "alphafold-2021"], tone: "green" },
    { id: "cosmos", name: "宇宙的回声", desc: "从微波背景到引力波，人类如何听见宇宙。", papers: ["penzias-wilson-1965", "ligo-2016"], tone: "blue" },
    { id: "repro", name: "可重复性危机", desc: "当实验结果无法复现，我们该相信什么？", papers: ["lk99-2023"], tone: "red" }
  ],

  seedComments: {
    "einstein-1905": [
      { author: "夜航星", time: "2 天前", body: "以前只知道“光很强就能打出电子”，原来关键在频率。原文里截止电压那张图讲得很清楚。" },
      { author: "材料系小张", time: "1 天前", body: "想请教一下：逸出功对表面状态很敏感，那定量实验是怎么控制样品表面的？" }
    ],
    "ligo-2016": [
      { author: "引力波观测员", time: "3 天前", body: "两台探测器相距 3000 公里这一点很关键——本地扰动很难同时在两端以正确时延出现。" },
      { author: "本科三年级", time: "1 天前", body: "1e-21 的应变到底有多小？有没有直观一点的类比？" }
    ],
    "lk99-2023": [
      { author: "冷静看证据", time: "5 天前", body: "这篇适合拿来练习证据判断：电阻下降、磁性、悬浮，各自能说明什么、不能说明什么。" },
      { author: "物理所搬砖", time: "3 天前", body: "补充：多组复现没有观察到室温超导，但讨论时应区分“未复现”与“造假”，这是两件事。" }
    ]
  }
};

// 浏览器与 Node 双用：原型直接加载，服务端入库时 require 复用同一份数据。
if (typeof window !== "undefined") window.DATA = DATA;
if (typeof module !== "undefined" && module.exports) module.exports = DATA;
