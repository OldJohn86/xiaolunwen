/* 小论文 · 大智慧 — 原型交互
 * 所有插入页面的数据都经过 esc() 转义；HTML 片段仅来自本文件内的模板。
 * 这里使用 createContextualFragment 构建片段，而不是直接赋值 HTML 字符串。
 */
(function () {
  "use strict";

  let DATA = window.DATA;
  let papers = DATA.papers;
  let byId = Object.fromEntries(papers.map(p => [p.id, p]));

  const STORAGE_SAVED = "xlw:saved";
  const STORAGE_COMMENTS = "xlw:comments:";

  const TAG_LABEL = {
    demo: "原理可演示",
    logic: "仅逻辑解读",
    controversy: "学界存在争议"
  };

  const ACTION_LABEL = {
    display_metadata: "展示元数据",
    display_abstract: "展示摘要",
    quote_commentary: "短引用 + 评论",
    translate_fulltext: "全文翻译",
    adapt_fulltext: "改编 / 演示",
    audio_fulltext: "全文音频",
    redistribute_fulltext: "再分发全文",
    commercial_use: "商业使用"
  };

  const REVIEW_LICENSES = [
    ["UNVERIFIED", "待核对（仅摘要）"],
    ["PROPRIETARY-ABSTRACT-ONLY", "出版社版权（仅摘要）"],
    ["ARXIV-NONEXCLUSIVE", "arXiv 非独占"],
    ["CC-BY-4.0", "CC BY 4.0"],
    ["CC-BY-3.0", "CC BY 3.0"],
    ["CC-BY-SA-4.0", "CC BY-SA 4.0"],
    ["CC-BY-NC-4.0", "CC BY-NC 4.0"],
    ["CC-BY-NC-SA-4.0", "CC BY-NC-SA 4.0"],
    ["CC-BY-ND-4.0", "CC BY-ND 4.0"],
    ["CC-BY-NC-ND-4.0", "CC BY-NC-ND 4.0"],
    ["CC0-1.0", "CC0 1.0"],
    ["PUBLIC-DOMAIN", "公有领域"]
  ];

  const REVIEW_STATUS_LABEL = {
    pending: "待复核",
    reviewed: "已复核",
    rejected: "已驳回"
  };

  const DECISION_LABEL = {
    approve: "确认无误",
    update_license: "更新许可证",
    reject: "驳回"
  };

  const state = {
    view: "discover",
    field: "全部",
    tag: "全部",
    query: "",
    sort: "featured",
    favOnly: false,
    topic: null,
    apiMode: false,
    reviewFilter: "all",
    reviewToken: readSession("xlw:review-token"),
    saved: new Set(asArray(readJSON(STORAGE_SAVED, [])))
  };

  const els = {
    discover: document.getElementById("discoverView"),
    knowledge: document.getElementById("knowledgeView"),
    review: document.getElementById("reviewView"),
    reviewNav: document.getElementById("reviewNav"),
    metrics: document.getElementById("metricsView"),
    metricsNav: document.getElementById("metricsNav"),
    metricsSummary: document.getElementById("metricsSummary"),
    metricsFunnel: document.getElementById("metricsFunnel"),
    metricsWeekly: document.getElementById("metricsWeekly"),
    metricsRefresh: document.getElementById("metricsRefresh"),
    reviewSummary: document.getElementById("reviewSummary"),
    reviewFilters: document.getElementById("reviewFilters"),
    reviewList: document.getElementById("reviewList"),
    reviewExport: document.getElementById("reviewExport"),
    reviewToken: document.getElementById("reviewToken"),
    reviewTokenSave: document.getElementById("reviewTokenSave"),
    reviewAuthNote: document.getElementById("reviewAuthNote"),
    feed: document.getElementById("feed"),
    feedTitle: document.getElementById("feedTitle"),
    resultCount: document.getElementById("resultCount"),
    fieldFilters: document.getElementById("fieldFilters"),
    tagFilters: document.getElementById("tagFilters"),
    search: document.getElementById("searchInput"),
    sort: document.getElementById("sortSelect"),
    favBtn: document.getElementById("favBtn"),
    favCount: document.getElementById("favCount"),
    conceptGrid: document.getElementById("conceptGrid"),
    conceptCount: document.getElementById("conceptCount"),
    topicGrid: document.getElementById("topicGrid"),
    statPapers: document.getElementById("statPapers"),
    statConcepts: document.getElementById("statConcepts"),
    overlay: document.getElementById("detailOverlay"),
    detail: document.getElementById("detailPanel"),
    dataSource: document.getElementById("dataSource"),
    toast: document.getElementById("toast")
  };

  let lastFocused = null;
  let toastTimer = null;
  let activeReadPaper = null;
  let readTracked = false;

  /* ---------- 工具 ---------- */

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 隐私模式等场景忽略 */ }
  }

  function readSession(key) {
    try { return sessionStorage.getItem(key) || ""; } catch { return ""; }
  }

  function writeSession(key, value) {
    try { sessionStorage.setItem(key, value); } catch { /* 隐私模式等场景忽略 */ }
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /* ---------- 匿名事件 ---------- */

  function randomId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getOrCreateUserId() {
    try {
      let id = localStorage.getItem("xlw:user-id");
      if (!id) {
        id = randomId();
        localStorage.setItem("xlw:user-id", id);
      }
      return id;
    } catch {
      return "anonymous";
    }
  }

  function getOrCreateSessionId() {
    try {
      let id = sessionStorage.getItem("xlw:session-id");
      if (!id) {
        id = randomId();
        sessionStorage.setItem("xlw:session-id", id);
      }
      return id;
    } catch {
      return "session";
    }
  }

  const USER_ID = getOrCreateUserId();
  const SESSION_ID = getOrCreateSessionId();

  function track(type, paperId, meta) {
    if (!state.apiMode) return;
    const payload = {
      type,
      userId: USER_ID,
      sessionId: SESSION_ID,
      paperId: paperId || null,
      meta: meta || {}
    };
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { /* 指标失败不影响阅读 */ });
  }

  /* ---------- 数据加载：API 优先，静态数据兜底 ---------- */

  function apiPaperToLocal(p) {
    const license = p.license || {};
    return {
      id: p.id,
      titleZh: (p.title && p.title.zh) || p.id,
      titleEn: (p.title && p.title.en) || "",
      authors: p.authors || "",
      journal: p.journal || "",
      year: p.year,
      citations: p.citations || 0,
      field: p.field || "综合",
      nobel: p.nobel || null,
      tag: p.tag || "logic",
      formula: p.formula || "",
      link: p.link || "#",
      originalLang: p.originalLanguage || "en",
      license: {
        spdx: license.code || "",
        code: license.label || license.code || "未标注",
        note: license.note || "",
        deep: Boolean(license.allowed && license.allowed.quote_commentary && license.allowed.quote_commentary.allowed),
        allowed: license.allowed || null
      },
      abstractZh: (p.abstracts && p.abstracts.zh && p.abstracts.zh.text) || "",
      abstractEn: (p.abstracts && p.abstracts.en && p.abstracts.en.text) || "",
      interpretation: p.interpretation || null,
      demo: p.demo || null,
      thinking: p.thinking || []
    };
  }

  function applyData(data) {
    DATA = data;
    papers = asArray(DATA.papers);
    byId = Object.fromEntries(papers.map(p => [p.id, p]));
  }

  async function loadData() {
    if (location.protocol === "file:") {
      return { mode: "static", data: window.DATA };
    }
    try {
      const response = await fetch("/api/bootstrap", {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const api = await response.json();
      if (!Array.isArray(api.papers) || !api.papers.length) throw new Error("empty dataset");
      return {
        mode: "api",
        data: {
          papers: api.papers.map(apiPaperToLocal),
          concepts: asArray(api.concepts),
          topics: asArray(api.topics),
          seedComments: api.comments && typeof api.comments === "object" ? api.comments : {}
        }
      };
    } catch (error) {
      console.warn("API 不可用，回退到本地静态数据：", error.message);
      return { mode: "static", data: window.DATA };
    }
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  // 用片段解析替代直接字符串赋值；内容由本文件的模板 + esc() 生成。
  function setHTML(el, html) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const fragment = range.createContextualFragment(html);
    el.replaceChildren(fragment);
  }

  function formatCitations(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function badge(tag) {
    return `<span class="badge badge-${esc(tag)}">${esc(TAG_LABEL[tag] || tag)}</span>`;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
  }

  /* ---------- 路由 ---------- */

  function showView(view) {
    state.view = view;
    els.discover.hidden = view !== "discover";
    els.knowledge.hidden = view !== "knowledge";
    els.review.hidden = view !== "review";
    els.metrics.hidden = view !== "metrics";
    document.querySelectorAll(".nav-btn[data-view]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.view === view);
    });
    window.scrollTo(0, 0);
  }

  function route() {
    const hash = location.hash || "#/discover";
    if (hash.startsWith("#/paper/")) {
      const id = decodeURIComponent(hash.slice("#/paper/".length));
      if (byId[id]) {
        openDetail(id);
        return;
      }
      history.replaceState(null, "", "#/discover");
      showView("discover");
      return;
    }
    if (hash === "#/knowledge") {
      closeDetail(false);
      showView("knowledge");
      return;
    }
    if (hash === "#/review") {
      closeDetail(false);
      if (state.apiMode) {
        showView("review");
        loadReviewQueue().catch(error => {
          setHTML(els.reviewList, `<div class="review-empty">复核队列加载失败：${esc(error.message)}</div>`);
        });
      } else {
        history.replaceState(null, "", "#/discover");
        showView("discover");
      }
      return;
    }
    if (hash === "#/metrics") {
      closeDetail(false);
      if (state.apiMode) {
        showView("metrics");
        loadMetrics().catch(error => {
          setHTML(els.metricsWeekly, `<div class="metrics-empty">指标加载失败：${esc(error.message)}</div>`);
        });
      } else {
        history.replaceState(null, "", "#/discover");
        showView("discover");
      }
      return;
    }
    closeDetail(false);
    showView("discover");
  }

  /* ---------- 发现页 ---------- */

  function fields() {
    return ["全部", ...Array.from(new Set(papers.map(p => p.field)))];
  }

  function renderFilters() {
    setHTML(els.fieldFilters, fields().map(f =>
      `<button class="chip${f === state.field ? " is-active" : ""}" data-field="${esc(f)}" aria-pressed="${f === state.field}">${esc(f)}</button>`
    ).join(""));
    const tags = [["全部", "全部类型"], ["demo", TAG_LABEL.demo], ["logic", TAG_LABEL.logic], ["controversy", TAG_LABEL.controversy]];
    setHTML(els.tagFilters, tags.map(([value, label]) =>
      `<button class="chip${value === state.tag ? " is-active" : ""}" data-tag="${esc(value)}" aria-pressed="${value === state.tag}">${esc(label)}</button>`
    ).join(""));
  }

  function filteredPapers() {
    let list = papers.slice();

    if (state.topic) {
      const topic = DATA.topics.find(t => t.id === state.topic);
      if (topic) list = list.filter(p => topic.papers.includes(p.id));
    }
    if (state.field !== "全部") list = list.filter(p => p.field === state.field);
    if (state.tag !== "全部") list = list.filter(p => p.tag === state.tag);
    if (state.favOnly) list = list.filter(p => state.saved.has(p.id));

    const q = state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(p => [
        p.titleZh, p.titleEn, p.authors, p.journal, p.abstractZh, p.field,
        DATA.concepts.filter(c => c.papers.includes(p.id)).map(c => c.name + c.en).join(" ")
      ].join(" ").toLowerCase().includes(q));
    }

    if (state.sort === "year") list.sort((a, b) => b.year - a.year);
    else if (state.sort === "citations") list.sort((a, b) => b.citations - a.citations);
    else if (state.topic) {
      const topic = DATA.topics.find(t => t.id === state.topic);
      if (topic) {
        list.sort((a, b) => topic.papers.indexOf(a.id) - topic.papers.indexOf(b.id));
      }
    } else list.sort((a, b) => (b.nobel ? 1 : 0) - (a.nobel ? 1 : 0));

    return list;
  }

  function cardHTML(p) {
    const saved = state.saved.has(p.id);
    return `
      <article class="card" data-paper="${esc(p.id)}" tabindex="0" role="button" aria-label="打开论文：${esc(p.titleZh)}">
        <div class="card-cover field-${esc(p.field)}">
          <span class="cover-formula">${esc(p.formula || "OPEN ACCESS")}</span>
          <div class="cover-badges">
            ${p.nobel ? '<span class="badge badge-nobel">诺奖</span>' : ""}
            ${badge(p.tag)}
          </div>
          <span class="cover-year" aria-hidden="true">${esc(p.year)}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(p.titleZh)}</h3>
          <p class="card-title-en">${esc(p.titleEn)}</p>
          <div class="card-meta">
            <span>${esc(p.journal)}</span><span>·</span>
            <span>${esc(p.year)}</span><span>·</span>
            <span>被引 ${esc(formatCitations(p.citations))}</span>
          </div>
          <p class="card-abstract">${esc(p.abstractZh)}</p>
        </div>
        <div class="card-footer">
          <span class="license${p.license.deep ? "" : " is-restricted"}">${esc(p.license.code)}</span>
          <span class="spacer"></span>
          <button class="icon-btn${saved ? " is-saved" : ""}" data-save="${esc(p.id)}" aria-label="${saved ? "取消收藏" : "收藏"}：${esc(p.titleZh)}" aria-pressed="${saved}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>
          </button>
        </div>
      </article>`;
  }

  function renderFeed() {
    const list = filteredPapers();

    let title = "发现";
    if (state.topic) {
      const topic = DATA.topics.find(t => t.id === state.topic);
      title = topic ? topic.name : "专题";
    } else if (state.favOnly) {
      title = "我的收藏";
    } else if (state.query.trim()) {
      title = `搜索“${state.query.trim()}”`;
    }

    els.feedTitle.textContent = title;
    els.resultCount.textContent = `共 ${list.length} 篇 · 所有解读均可追溯原文`;

    if (!list.length) {
      setHTML(els.feed, `<div class="empty"><strong>没有找到匹配的内容</strong>试试换个关键词，或清除筛选条件。</div>`);
      return;
    }
    setHTML(els.feed, list.map(cardHTML).join(""));
  }

  /* ---------- 知识库 ---------- */

  function renderConcepts() {
    els.conceptCount.textContent = `${DATA.concepts.length} 张`;
    setHTML(els.conceptGrid, DATA.concepts.map((c, i) => `
      <article class="concept-card">
        <div class="concept-head">
          <span class="concept-num">概念 ${String(i + 1).padStart(2, "0")}</span>
          <h3 class="concept-name">${esc(c.name)}</h3>
          <span class="concept-en">${esc(c.en)}</span>
        </div>
        <p class="concept-def">${esc(c.definition)}</p>
        <div class="concept-links">
          ${c.papers.map(id => {
            const p = byId[id];
            if (!p) return "";
            return `<button class="paper-chip" data-paper="${esc(p.id)}" title="${esc(p.titleZh)}">${esc(p.titleZh)}</button>`;
          }).join("")}
        </div>
      </article>`).join(""));
  }

  function renderTopics() {
    setHTML(els.topicGrid, DATA.topics.map(t => `
      <button class="topic-card tone-${esc(t.tone)}" data-topic="${esc(t.id)}">
        <span class="topic-count">${t.papers.length} 篇</span>
        <h3 class="topic-name">${esc(t.name)}</h3>
        <p class="topic-desc">${esc(t.desc)}</p>
      </button>`).join(""));
  }

  /* ---------- 详情 ---------- */

  function findConceptNames(paperId) {
    return DATA.concepts.filter(c => c.papers.includes(paperId)).map(c => c.name);
  }

  function commentsFor(paperId) {
    const all = DATA.seedComments || {};
    const seeded = asArray(all[paperId]).map(c => ({ ...c, seeded: true }));
    const local = state.apiMode ? [] : asArray(readJSON(STORAGE_COMMENTS + paperId, []));
    return [...seeded, ...local];
  }

  function commentsHTML(paper) {
    const list = commentsFor(paper.id);
    const items = list.length
      ? list.map(c => `
          <div class="comment">
            <div class="comment-head">
              <span class="avatar" aria-hidden="true">${esc((c.author || "访")[0])}</span>
              <span class="comment-author">${esc(c.author || "匿名")}</span>
              <span class="comment-time">${esc(c.time || "")}</span>
            </div>
            <p class="comment-body">${esc(c.body)}</p>
          </div>`).join("")
      : `<div class="no-comments">还没有讨论。围绕实验设计、证据与适用范围提出第一个问题吧。</div>`;

    return `
      <div class="comment-list" id="commentList">${items}</div>
      <form class="comment-form" id="commentForm">
        <textarea id="commentInput" placeholder="提出你的疑问：这个实验的对照设置合理吗？结论的适用范围是什么？" maxlength="500" aria-label="发表讨论"></textarea>
        <div class="form-foot">
          <span class="form-note">理性讨论 · 禁止人身攻击与随意定性造假 · 先审后发</span>
          <button type="submit" class="btn btn-primary">发表</button>
        </div>
      </form>`;
  }

  function sparkle() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>`;
  }

  function lockIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
  }

  function copyIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
  }

  function capabilitySection(p) {
    const allowed = p.license && p.license.allowed;
    if (!allowed) return "";
    const items = [
      ["translate_fulltext", "全文翻译"],
      ["audio_fulltext", "全文音频"],
      ["adapt_fulltext", "改编 / 演示"],
      ["redistribute_fulltext", "再分发全文"],
      ["commercial_use", "商业使用"]
    ];

    const cards = items.map(([key, label]) => {
      const item = allowed[key] || {};
      const ok = Boolean(item.allowed);
      return `<div class="cap ${ok ? "is-ok" : "is-no"}">
        <span class="cap-icon" aria-hidden="true">${ok ? "✓" : "✕"}</span>
        <div>
          <strong>${esc(label)}</strong>
          <p>${esc(item.reason || (ok ? "允许" : "不允许"))}</p>
          ${ok && item.legalReview ? '<span class="cap-review">需法务复核</span>' : ""}
        </div>
      </div>`;
    }).join("");

    return `
      <section class="detail-section">
        <h3>许可证能力 <span class="hint">${esc(p.license.code)} · 由服务端规则下发</span></h3>
        <div class="cap-grid">${cards}</div>
        <p class="form-note" style="margin:10px 0 0">受限能力在界面上直接隐藏或禁用；当前展示的是规则判定结果，不是法律意见。</p>
      </section>`;
  }

  function detailHTML(p) {
    const saved = state.saved.has(p.id);
    const conceptNames = findConceptNames(p.id);
    const refLabel = ref => `<button type="button" class="ref" data-evidence="${esc(ref)}" title="原型示意：点击记为展开证据，上线后可定位到原文段落">${esc(ref)}</button>`;

    const abstractSection = `
      <section class="detail-section">
        <h3>摘要 <span class="hint">平台整理 · 中英对照（非逐句翻译）</span></h3>
        <div class="lang-toggle" role="group" aria-label="摘要语言">
          <button type="button" data-lang="zh" class="is-active">中文</button>
          <button type="button" data-lang="en">English</button>
        </div>
        <p class="abstract-text" id="abstractText">${esc(p.abstractZh)}</p>
      </section>`;

    const interpSection = p.interpretation
      ? `<section class="detail-section">
          <h3>AI 结构化解读 <span class="ai-label">${sparkle()}AI 辅助整理 · 待复核</span></h3>
          <div class="interp-list">
            ${p.interpretation.map(item => `
              <div class="interp-item">
                <p class="interp-label">${esc(item.label)}</p>
                <p class="interp-text">${esc(item.text)}</p>
                ${item.ref ? refLabel(item.ref) : ""}
              </div>`).join("")}
          </div>
          <p class="form-note" style="margin:10px 0 0">每条解读均标注原文出处；原型中的出处为示意，上线后应可跳转并高亮原文段落。</p>
        </section>`
      : `<section class="detail-section">
          <div class="notice">
            ${lockIcon()}
            <div>
              ${p.license && p.license.spdx === "UNVERIFIED"
                ? `<strong>许可证待核对：仅展示元数据与摘要</strong>
                   该文献的许可证尚未确认，因此不提供 AI 精读与原文引用。请通过官方链接阅读原文；确认许可后再开放深度处理。`
                : `<strong>版权限制：仅展示元数据与摘要</strong>
                   该文献的许可证不允许本平台进行翻译、演绎或深度解读，因此不提供 AI 精读。请通过官方链接阅读原文。平台仅收录可公开传播的开放获取文献，并逐篇校验许可证。`}
            </div>
          </div>
        </section>`;

    const thinkingSection = `<section class="detail-section">
      <h3>思辨引导 <span class="hint">证据优先 · 理性怀疑</span></h3>
      <div class="thinking-box">
        <ol>${p.thinking.map(q => `<li>${esc(q)}</li>`).join("")}</ol>
      </div>
    </section>`;

    const demoSection = p.demo ? `
      <section class="detail-section">
        <h3>科普演示</h3>
        <div class="demo-box">
          <span class="demo-flag ${p.demo.available ? "yes" : "no"}">${p.demo.available ? "【原理可演示】" : "【仅逻辑解读，无法简易验证】"}</span>
          <h4>${esc(p.demo.title)}</h4>
          <p>${esc(p.demo.note)}</p>
        </div>
      </section>` : "";

    return `
      <button class="detail-close" data-action="close" aria-label="关闭详情">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="detail-hero field-${esc(p.field)}">
        <div class="detail-kicker">
          ${badge(p.tag)}
          ${p.nobel ? `<span class="badge badge-nobel">${esc(p.nobel)}</span>` : ""}
          <span class="badge">${esc(p.field)}</span>
        </div>
        <h2 class="detail-title">${esc(p.titleZh)}</h2>
        <p class="detail-title-en">${esc(p.titleEn)}</p>
        <div class="detail-meta">
          <span>${esc(p.authors)}</span><span class="sep">·</span>
          <span>${esc(p.journal)} · ${esc(p.year)}</span><span class="sep">·</span>
          <span>被引 ${esc(formatCitations(p.citations))}</span><span class="sep">·</span>
          <span>${esc(p.license.code)}</span>
        </div>
      </div>
      <div class="detail-body">
        ${abstractSection}
        ${capabilitySection(p)}
        ${interpSection}
        ${demoSection}
        ${thinkingSection}
        ${conceptNames.length ? `<section class="detail-section">
          <h3>相关知识</h3>
          <div class="concept-links">${conceptNames.map(name => `<span class="paper-chip" style="cursor:default">${esc(name)}</span>`).join("")}</div>
        </section>` : ""}
        <section class="detail-section">
          <h3>讨论 <span class="hint" id="commentCount">${commentsFor(p.id).length} 条</span></h3>
          ${commentsHTML(p)}
        </section>
      </div>
      <div class="detail-actions">
        <button class="btn${saved ? " is-saved" : ""}" data-save="${esc(p.id)}" aria-pressed="${saved}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>
          ${saved ? "已收藏" : "收藏"}
        </button>
        <button class="btn" data-action="copy" data-link="${esc(p.link)}">
          ${copyIcon()}复制原文链接
        </button>
        <a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" data-action="source">前往原文 ↗</a>
        <span class="spacer"></span>
        <span class="form-note">本内容仅为科普解读，不代表学术鉴定 · 原始结论以原文为准</span>
      </div>`;
  }

  function openDetail(id) {
    const p = byId[id];
    if (!p) return;
    if (els.overlay.hidden) lastFocused = document.activeElement;
    els.detail.dataset.paperId = p.id;
    setHTML(els.detail, detailHTML(p));
    els.overlay.hidden = false;
    document.body.style.overflow = "hidden";

    activeReadPaper = p.id;
    readTracked = false;
    track("paper_open", p.id);

    const openedId = p.id;
    setTimeout(() => {
      if (activeReadPaper !== openedId || readTracked) return;
      if (els.detail.scrollHeight <= els.detail.clientHeight + 24) {
        readTracked = true;
        track("read_complete", openedId);
      }
    }, 1500);

    bindLangToggle(p);

    const closeBtn = els.detail.querySelector(".detail-close");
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    els.detail.scrollTop = 0;
  }

  function bindLangToggle(p) {
    const langBtns = els.detail.querySelectorAll("[data-lang]");
    const abstractEl = els.detail.querySelector("#abstractText");
    langBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        langBtns.forEach(b => b.classList.toggle("is-active", b === btn));
        const isEn = btn.dataset.lang === "en";
        abstractEl.textContent = isEn ? p.abstractEn : p.abstractZh;
        abstractEl.classList.toggle("is-en", isEn);
      });
    });
  }

  function closeDetail(updateHash) {
    if (els.overlay.hidden) return;
    els.overlay.hidden = true;
    els.detail.replaceChildren();
    delete els.detail.dataset.paperId;
    activeReadPaper = null;
    readTracked = false;
    document.body.style.overflow = "";
    if (updateHash && location.hash.startsWith("#/paper/")) {
      history.replaceState(null, "", state.view === "knowledge" ? "#/knowledge" : "#/discover");
    }
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
      lastFocused = null;
    }
  }

  /* ---------- 收藏 ---------- */

  function toggleSave(id) {
    if (state.saved.has(id)) {
      state.saved.delete(id);
      toast("已取消收藏");
    } else {
      state.saved.add(id);
      toast("已加入收藏");
      track("favorite", id);
    }
    writeJSON(STORAGE_SAVED, Array.from(state.saved));
    syncSaveUI(id);
    if (state.favOnly) renderFeed();
  }

  function syncSaveUI(id) {
    const saved = state.saved.has(id);
    const p = byId[id];
    document.querySelectorAll("[data-save]").forEach(btn => {
      if (btn.dataset.save !== id) return;
      btn.classList.toggle("is-saved", saved);
      btn.setAttribute("aria-pressed", String(saved));
      if (btn.classList.contains("btn")) {
        setHTML(btn, `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>${saved ? "已收藏" : "收藏"}`);
      } else {
        btn.setAttribute("aria-label", `${saved ? "取消收藏" : "收藏"}：${p ? p.titleZh : ""}`);
      }
    });
    els.favCount.textContent = String(state.saved.size);
  }

  /* ---------- 评论 ---------- */

  function refreshCommentArea(p) {
    const holder = document.createElement("div");
    setHTML(holder, commentsHTML(p));
    const newList = holder.querySelector("#commentList");
    const newForm = holder.querySelector("#commentForm");
    const oldList = els.detail.querySelector("#commentList");
    const oldForm = els.detail.querySelector("#commentForm");
    if (oldList && newList) oldList.replaceWith(newList);
    if (oldForm && newForm) oldForm.replaceWith(newForm);
    const count = els.detail.querySelector("#commentCount");
    if (count) count.textContent = `${commentsFor(p.id).length} 条`;
  }

  async function submitComment() {
    const paperId = els.detail.dataset.paperId;
    const p = byId[paperId];
    const form = els.detail.querySelector("#commentForm");
    const input = els.detail.querySelector("#commentInput");
    if (!p || !form || !input) return;
    const body = input.value.trim();
    if (!body) {
      toast("先写下你的问题或观点");
      input.focus();
      return;
    }

    if (state.apiMode) {
      const button = form.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      try {
        const response = await fetch(`/api/papers/${encodeURIComponent(p.id)}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ author: "我", body })
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error((error.error && error.error.message) || "发布失败");
        }
        const listResponse = await fetch(`/api/papers/${encodeURIComponent(p.id)}/comments`, {
          cache: "no-store"
        });
        if (!listResponse.ok) throw new Error("评论列表刷新失败");
        const listData = await listResponse.json();
        DATA.seedComments = DATA.seedComments || {};
        DATA.seedComments[p.id] = asArray(listData.comments).map(comment => ({
          author: comment.author,
          time: comment.timeLabel || comment.createdAt,
          body: comment.body
        }));
      } catch (error) {
        toast(error.message);
        return;
      } finally {
        if (button) button.disabled = false;
      }
    } else {
      const key = STORAGE_COMMENTS + p.id;
      const local = asArray(readJSON(key, []));
      local.push({
        author: "我",
        time: new Date().toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        body
      });
      writeJSON(key, local);
    }

    track("comment", p.id);
    refreshCommentArea(p);
    toast(state.apiMode ? "已发布" : "已发布（本地存储）");
  }

  /* ---------- 复核工作台 ---------- */

  function reviewFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.reviewToken) headers.set("Authorization", `Bearer ${state.reviewToken}`);
    return fetch(path, { ...options, headers });
  }

  async function loadReviewQueue() {
    const response = await reviewFetch(
      `/api/review/queue?filter=${encodeURIComponent(state.reviewFilter)}`,
      { cache: "no-store" }
    );
    if (response.status === 401) throw new Error("需要复核令牌");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderReviewQueue(await response.json());
  }

  async function exportReviewCsv() {
    const response = await reviewFetch(
      `/api/review/export.csv?filter=${encodeURIComponent(state.reviewFilter)}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error.error && error.error.message) || "导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `review-${state.reviewFilter}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("已导出 CSV");
  }

  function reviewItemHTML(item) {
    const flags = [];
    if (item.flags.unverified) flags.push('<span class="flag flag-warn">许可证待核对</span>');
    if (item.flags.legalReview) flags.push('<span class="flag flag-info">需法务复核</span>');
    if (item.flags.denied) flags.push(`<span class="flag flag-muted">受限 ${item.deniedActions.length} 项</span>`);
    const status = item.review.status || "pending";
    flags.push(
      `<span class="flag ${status === "reviewed" ? "flag-ok" : status === "rejected" ? "flag-warn" : "flag-muted"}">${esc(REVIEW_STATUS_LABEL[status] || status)}</span>`
    );

    const denied = item.deniedActions.map(entry => ACTION_LABEL[entry.action] || entry.action).join("、");
    const review = item.legalReviewActions.map(action => ACTION_LABEL[action] || action).join("、");
    const options = REVIEW_LICENSES.map(([code, label]) =>
      `<option value="${esc(code)}"${code === item.license.code ? " selected" : ""}>${esc(label)}</option>`
    ).join("");

    return `
      <article class="review-item" data-review-item="${esc(item.id)}">
        <div class="review-head">
          <h3 class="review-title">${esc(item.title.zh)}</h3>
          <span class="review-meta">${esc(item.journal)} · ${esc(item.year)}</span>
          <span class="review-meta">${esc(item.authors)}</span>
        </div>
        <div class="review-flags">
          ${flags.join("")}
          <span class="flag flag-muted">当前：${esc(item.license.label || item.license.code)}</span>
        </div>
        ${denied ? `<p class="review-reasons"><strong>受限能力：</strong>${esc(denied)}</p>` : ""}
        ${review ? `<p class="review-reasons"><strong>需法务复核：</strong>${esc(review)}</p>` : ""}
        ${item.review.note ? `<p class="review-reasons"><strong>复核备注：</strong>${esc(item.review.note)}</p>` : ""}
        ${item.license.source ? `<p class="review-reasons"><strong>许可来源：</strong>${esc(item.license.source)}</p>` : ""}
        ${Array.isArray(item.history) && item.history.length ? `
          <details class="review-history">
            <summary>复核历史（${item.history.length}）</summary>
            <ul>${item.history.map(entry => `<li><strong>${esc(DECISION_LABEL[entry.decision] || entry.decision)}</strong> · ${esc(entry.previousLicense || "—")} → ${esc(entry.newLicense || "—")} · ${esc(entry.createdAt)}${entry.note ? ` · ${esc(entry.note)}` : ""}</li>`).join("")}</ul>
          </details>` : ""}
        <div class="review-actions">
          <select data-review-license aria-label="许可证">${options}</select>
          <input data-review-note maxlength="200" placeholder="复核备注（可选）" aria-label="复核备注">
          <input data-review-source maxlength="300" placeholder="许可证来源 / 证据链接（可选）" aria-label="许可证来源">
          <button class="btn" data-review-action="update">更新许可证并复核</button>
          <button class="btn btn-primary" data-review-action="approve">确认无误</button>
        </div>
      </article>`;
  }

  function renderReviewQueue(data) {
    const summary = data.summary || {};
    const stats = [
      ["total", "全部", "", summary.total],
      ["unverified", "待核对", "is-warn", summary.unverified],
      ["legal_review", "需法务复核", "is-info", summary.legalReview],
      ["denied", "有拒绝项", "", summary.denied],
      ["reviewed", "已复核", "is-ok", summary.reviewed]
    ];
    setHTML(els.reviewSummary, stats.map(([, label, tone, value]) =>
      `<div class="review-stat ${tone}"><strong>${esc(value == null ? "—" : value)}</strong><span>${esc(label)}</span></div>`
    ).join(""));

    const filters = [
      ["all", "全部"], ["unverified", "待核对"], ["legal_review", "需法务复核"],
      ["denied", "有拒绝项"], ["reviewed", "已复核"]
    ];
    setHTML(els.reviewFilters, filters.map(([value, label]) =>
      `<button class="chip${value === state.reviewFilter ? " is-active" : ""}" data-review-filter="${esc(value)}" aria-pressed="${value === state.reviewFilter}">${esc(label)}</button>`
    ).join(""));

    if (!Array.isArray(data.items) || !data.items.length) {
      setHTML(els.reviewList, `<div class="review-empty">当前筛选下没有需要复核的内容。</div>`);
      return;
    }
    setHTML(els.reviewList, data.items.map(reviewItemHTML).join(""));
  }

  async function submitReview(id, action) {
    const item = els.reviewList.querySelector(`[data-review-item="${CSS.escape(id)}"]`);
    if (!item) return;
    const licenseCode = item.querySelector("[data-review-license]").value;
    const note = item.querySelector("[data-review-note]").value.trim();
    const licenseSource = item.querySelector("[data-review-source]")
      ? item.querySelector("[data-review-source]").value.trim()
      : "";
    const payload = action === "update"
      ? { decision: "update_license", licenseCode, note, licenseSource }
      : { decision: "approve", note, licenseSource };

    const response = await reviewFetch(`/api/review/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error.error && error.error.message) || "复核保存失败");
    }
    toast(action === "update" ? `已更新许可证：${licenseCode}` : "已标记复核");
    await loadReviewQueue();
  }

  /* ---------- 指标看板 ---------- */

  async function loadMetrics() {
    const response = await fetch("/api/metrics/overview", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderMetrics(await response.json());
  }

  function renderMetrics(data) {
    const funnel = data.funnel || {};
    const stats = [
      ["本周读到达标", funnel.readReachedUsersThisWeek, "is-ok"],
      ["打开论文人数", funnel.openUsers, ""],
      ["展开证据人数", funnel.evidenceUsers, "is-info"],
      ["互动人数", funnel.interactionUsers, ""],
      ["事件总数", data.totals ? data.totals.events : 0, ""]
    ];
    setHTML(els.metricsSummary, stats.map(([label, value, tone]) =>
      `<div class="review-stat ${tone}"><strong>${esc(value == null ? 0 : value)}</strong><span>${esc(label)}</span></div>`
    ).join(""));

    const rows = [
      ["打开论文", funnel.openUsers],
      ["展开证据", funnel.evidenceUsers],
      ["产生互动", funnel.interactionUsers],
      ["读到达标（全周期）", funnel.readReachedUsersAllTime]
    ];
    const max = Math.max(1, ...rows.map(([, value]) => value || 0));
    setHTML(els.metricsFunnel, rows.map(([label, value]) => {
      const count = value || 0;
      const width = Math.round((count / max) * 100);
      return `<div class="metrics-row">
        <span class="metrics-label">${esc(label)}</span>
        <div class="metrics-bar"><span style="width:${width}%"></span></div>
        <span class="metrics-value">${esc(count)}</span>
      </div>`;
    }).join(""));

    if (!Array.isArray(data.weekly) || !data.weekly.length) {
      setHTML(els.metricsWeekly, `<div class="metrics-empty">还没有事件。打开几篇论文、展开证据并互动后，这里会出现数据。</div>`);
      return;
    }

    setHTML(els.metricsWeekly, `
      <table>
        <thead><tr><th>周</th><th>事件</th><th>用户</th><th>读到达标用户</th></tr></thead>
        <tbody>${data.weekly.map(row => `
          <tr>
            <td>${esc(row.week)}${row.week === data.currentWeek ? "（本周）" : ""}</td>
            <td>${esc(row.events)}</td>
            <td>${esc(row.users)}</td>
            <td>${esc(row.readReachedUsers)}</td>
          </tr>`).join("")}</tbody>
      </table>`);
  }

  /* ---------- 事件 ---------- */

  function bindEvents() {
    els.fieldFilters.addEventListener("click", event => {
      const btn = event.target.closest("[data-field]");
      if (!btn) return;
      state.field = btn.dataset.field;
      state.topic = null;
      renderFilters();
      renderFeed();
    });

    els.tagFilters.addEventListener("click", event => {
      const btn = event.target.closest("[data-tag]");
      if (!btn) return;
      state.tag = btn.dataset.tag;
      state.topic = null;
      renderFilters();
      renderFeed();
    });

    els.reviewFilters.addEventListener("click", event => {
      const btn = event.target.closest("[data-review-filter]");
      if (!btn) return;
      state.reviewFilter = btn.dataset.reviewFilter;
      loadReviewQueue().catch(error => toast(error.message));
    });

    els.reviewTokenSave.addEventListener("click", () => {
      state.reviewToken = els.reviewToken.value.trim();
      writeSession("xlw:review-token", state.reviewToken);
      els.reviewAuthNote.textContent = state.reviewToken
        ? "令牌已保存到当前标签页"
        : "未设置令牌（仅适用于未启用保护的服务）";
      loadReviewQueue().catch(error => toast(error.message));
    });

    els.reviewExport.addEventListener("click", () => {
      exportReviewCsv().catch(error => toast(error.message));
    });

    els.metricsRefresh.addEventListener("click", () => {
      loadMetrics().catch(error => toast(error.message));
    });

    els.search.addEventListener("input", () => {
      state.query = els.search.value;
      state.topic = null;
      if (state.view !== "discover") {
        showView("discover");
        history.replaceState(null, "", "#/discover");
      }
      renderFeed();
    });

    els.sort.addEventListener("change", () => {
      state.sort = els.sort.value;
      renderFeed();
    });

    els.favBtn.addEventListener("click", () => {
      state.favOnly = !state.favOnly;
      state.topic = null;
      if (state.view !== "discover") {
        showView("discover");
        history.replaceState(null, "", "#/discover");
      }
      els.favBtn.setAttribute("aria-pressed", String(state.favOnly));
      els.favBtn.classList.toggle("is-active", state.favOnly);
      renderFeed();
      if (state.favOnly) toast("正在查看收藏");
    });

    document.querySelectorAll(".nav-btn[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        const routes = {
          discover: "#/discover",
          knowledge: "#/knowledge",
          review: "#/review",
          metrics: "#/metrics"
        };
        location.hash = routes[btn.dataset.view] || "#/discover";
      });
    });

    document.addEventListener("click", event => {
      const evidenceBtn = event.target.closest("[data-evidence]");
      if (evidenceBtn) {
        const paperId = els.detail.dataset.paperId;
        if (paperId) {
          track("evidence_expand", paperId, { ref: evidenceBtn.dataset.evidence });
        }
        toast(`原文定位：${evidenceBtn.dataset.evidence}（原型示意）`);
        return;
      }

      const sourceLink = event.target.closest("[data-action='source']");
      if (sourceLink) {
        const paperId = els.detail.dataset.paperId;
        if (paperId) track("source_click", paperId, { href: sourceLink.href });
        return;
      }

      const reviewBtn = event.target.closest("[data-review-action]");
      if (reviewBtn) {
        event.preventDefault();
        const item = reviewBtn.closest("[data-review-item]");
        if (item) {
          submitReview(item.dataset.reviewItem, reviewBtn.dataset.reviewAction)
            .catch(error => toast(error.message));
        }
        return;
      }

      const saveBtn = event.target.closest("[data-save]");
      if (saveBtn) {
        event.preventDefault();
        event.stopPropagation();
        toggleSave(saveBtn.dataset.save);
        return;
      }

      const paperEl = event.target.closest("[data-paper]");
      if (paperEl) {
        location.hash = "#/paper/" + encodeURIComponent(paperEl.dataset.paper);
        return;
      }

      const topicEl = event.target.closest("[data-topic]");
      if (topicEl) {
        state.topic = topicEl.dataset.topic;
        state.field = "全部";
        state.tag = "全部";
        state.query = "";
        els.search.value = "";
        state.favOnly = false;
        els.favBtn.classList.remove("is-active");
        els.favBtn.setAttribute("aria-pressed", "false");
        renderFilters();
        renderFeed();
        showView("discover");
        history.replaceState(null, "", "#/discover");
        return;
      }

      if (event.target.closest("[data-action='close']")) {
        closeDetail(true);
        return;
      }

      const copyBtn = event.target.closest("[data-action='copy']");
      if (copyBtn) {
        const paperId = els.detail.dataset.paperId;
        if (paperId) track("source_click", paperId, { copy: true });
        const text = copyBtn.dataset.link;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            () => toast("链接已复制"),
            () => toast("复制失败，请手动打开原文")
          );
        } else {
          toast("当前环境不支持自动复制");
        }
      }
    });

    document.addEventListener("submit", event => {
      if (event.target && event.target.id === "commentForm") {
        event.preventDefault();
        submitComment();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !els.overlay.hidden) {
        closeDetail(true);
        return;
      }
      const card = event.target.closest && event.target.closest(".card");
      if (card && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        location.hash = "#/paper/" + encodeURIComponent(card.dataset.paper);
      }
    });

    els.overlay.addEventListener("click", event => {
      if (event.target === els.overlay) closeDetail(true);
    });

    els.detail.addEventListener("scroll", () => {
      if (!activeReadPaper || readTracked) return;
      if (els.detail.scrollTop + els.detail.clientHeight >= els.detail.scrollHeight - 80) {
        readTracked = true;
        track("read_complete", activeReadPaper);
      }
    }, { passive: true });

    window.addEventListener("hashchange", route);
  }

  /* ---------- 启动 ---------- */

  async function init() {
    const loaded = await loadData();
    applyData(loaded.data);
    state.apiMode = loaded.mode === "api";

    if (els.dataSource) {
      els.dataSource.textContent = state.apiMode
        ? "数据来源：API + SQLite · 许可证能力由服务端下发"
        : "数据来源：本地静态示例 · 使用内置许可证提示";
    }
    if (els.reviewNav) els.reviewNav.hidden = !state.apiMode;
    if (els.metricsNav) els.metricsNav.hidden = !state.apiMode;
    if (els.reviewToken) els.reviewToken.value = state.reviewToken;
    if (els.reviewAuthNote && state.reviewToken) {
      els.reviewAuthNote.textContent = "已载入本标签页保存的令牌";
    }

    els.statPapers.textContent = String(papers.length);
    els.statConcepts.textContent = String(asArray(DATA.concepts).length);
    renderFilters();
    renderConcepts();
    renderTopics();
    renderFeed();
    els.favCount.textContent = String(state.saved.size);
    bindEvents();
    route();
  }

  init().catch(error => {
    console.error(error);
    setHTML(els.feed, `<div class="empty"><strong>页面初始化失败</strong>请刷新重试，或检查 API 是否可用。</div>`);
  });
})();
