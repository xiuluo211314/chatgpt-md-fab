(() => {
  if (window.__chatgpt_extractor_injected__) return;
  window.__chatgpt_extractor_injected__ = true;

  // =============== 配色（深色相近但更深一点） ===============
  const theme = (() => {
    const isDark = document.documentElement.classList.contains("dark")
      || window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;

    const dark = {
      bg: "#2a2b32",
      bgHover: "#32333b",
      border: "#3a3b44",
      text: "#e8e9ee",
      subtle: "#9aa0a6",
      info: "#60a5fa",
      warn: "#f59e0b",
      error: "#ef4444",
      shadow: "0 10px 22px rgba(0,0,0,.35)"
    };
    const light = {
      bg: "#1f2937",
      bgHover: "#263042",
      border: "#394456",
      text: "#eef2ff",
      subtle: "#c7d2fe",
      info: "#60a5fa",
      warn: "#f59e0b",
      error: "#ef4444",
      shadow: "0 10px 22px rgba(0,0,0,.25)"
    };
    return isDark ? dark : light;
  })();

  const STORE_KEY = "__chatgpt_fab_pos__";

  // =============== Toast（替代 alert，默认 2s 自动消失） ===============
  function ensureToastHost() {
    let host = document.querySelector(".gpt-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "gpt-toast-host";
      const s = document.createElement("style");
      s.textContent = `
        .gpt-toast-host {
          position: fixed;
          right: 20px;
          bottom: 90px;
          z-index: 1000000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .gpt-toast {
          pointer-events: auto;
          min-width: 220px;
          max-width: 420px;
          background: ${theme.bg};
          color: ${theme.text};
          border: 1px solid ${theme.border};
          box-shadow: ${theme.shadow};
          border-radius: 12px;
          padding: 10px 12px 10px 14px;
          font: 500 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          display: grid;
          grid-template-columns: 6px auto;
          gap: 10px;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity .18s ease, transform .18s ease;
        }
        .gpt-toast.show { opacity: 1; transform: translateY(0); }
        .gpt-toast__bar { border-radius: 10px; }
        .gpt-toast__content { white-space: pre-wrap; word-break: break-word; }
      `;
      document.documentElement.appendChild(s);
      document.documentElement.appendChild(host);
    }
    return host;
  }

  // type: 'info' | 'warn' | 'error'
  function toast(message, type = "info", duration = 2000) {
    const host = ensureToastHost();
    const node = document.createElement("div");
    node.className = "gpt-toast";
    const bar = document.createElement("div");
    bar.className = "gpt-toast__bar";
    bar.style.background =
      type === "error" ? theme.error :
      type === "warn" ? theme.warn : theme.info;
    const content = document.createElement("div");
    content.className = "gpt-toast__content";
    content.textContent = message;

    node.appendChild(bar);
    node.appendChild(content);
    host.appendChild(node);
    // 动画进场
    requestAnimationFrame(() => node.classList.add("show"));

    // 自动消失
    const remover = () => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 200);
    };
    const timer = setTimeout(remover, Math.max(800, duration));

    // 点击可立即关闭
    node.addEventListener("click", () => {
      clearTimeout(timer);
      remover();
    });
  }

  // =============== 选中回答 → Markdown（核心逻辑） ===============
  function toEl(n) { return n && n.nodeType === 3 ? n.parentElement : n; }

  function getAssistantContainer() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = toEl(sel.getRangeAt(0).commonAncestorContainer);

    const isAns = el => {
      if (!el || !el.closest) return null;
      return el.closest(
        '[data-message-author-role="assistant"], [data-testid^="conversation-turn-"], article:has(.markdown), div:has(> .markdown)'
      );
    };

    let hit = isAns(node);
    if (hit) return hit;

    const mk = node.closest ? node.closest(".markdown") : null;
    if (mk) {
      const a = mk.closest(
        '[data-message-author-role="assistant"], [data-testid^="conversation-turn-"], article, div'
      );
      if (a) return a;
    }

    let cur = toEl(window.getSelection().anchorNode);
    while (cur && !isAns(cur)) cur = cur.parentElement;
    return cur ? isAns(cur) : null;
  }

  function pickContentEl(ans) {
    if (!ans) return null;
    return ans.querySelector(".markdown") || ans.querySelector("article") || ans;
  }

  function polyReplaceAll(s, a, b) { return (s || "").split(a).join(b); }
  function repNL(s) { return (s || "").replace(/\r\n?/g, "\n"); }
  function fenceFor(code) {
    const matches = code.match(/`+/g) || [];
    let max = 3;
    for (const m of matches) if (m.length >= max) max = m.length + 1;
    return "`".repeat(max);
    }

  function htmlToMd(root) {
    const tmp = root.cloneNode(true);
    Array.from(tmp.querySelectorAll(
      'button,svg[aria-hidden="true"],[contenteditable],form,nav,header,footer,[data-state],.sr-only'
    )).forEach(n => n.remove && n.remove());

    const mBlocks = [], mInlines = [];
    Array.from(tmp.querySelectorAll(".katex-display")).forEach(el => {
      const ann = el.querySelector('annotation[encoding="application/x-tex"]');
      const tex = (ann ? ann.textContent : "").trim();
      const key = "__MATHD_" + mBlocks.length + "__";
      mBlocks.push(tex); el.outerHTML = key;
    });
    Array.from(tmp.querySelectorAll(".katex:not(.katex-display)")).forEach(el => {
      const ann = el.querySelector('annotation[encoding="application/x-tex"]');
      const tex = (ann ? ann.textContent : "").trim();
      const key = "__MATHI_" + mInlines.length + "__";
      mInlines.push(tex); el.outerHTML = key;
    });

    const codeBlocks = [];
    Array.from(tmp.querySelectorAll("pre code")).forEach(code => {
      const lang = ((code.className || "").match(/language-([\w-]+)/i) || [])[1] || "";
      const text = (code.textContent || "").replace(/\u00A0/g, " ");
      const key = "__CODE_" + codeBlocks.length + "__";
      code.parentElement.outerHTML = key;
      codeBlocks.push({ lang, text });
    });

    function walk(node) {
      if (node.nodeType === 3) return node.nodeValue;
      if (node.nodeType !== 1) return "";

      const t = node.tagName.toLowerCase();
      if (t === "br") return "\n";
      if (/^h[1-6]$/.test(t)) {
        const lv = +t[1];
        return "\n" + "#".repeat(lv) + " " + inline(node).trim() + "\n";
      }
      if (t === "p") return "\n" + inline(node).trim() + "\n";
      if (t === "strong" || t === "b") return "**" + inline(node) + "**";
      if (t === "em" || t === "i") return "*" + inline(node) + "*";
      if (t === "code") {
        const ct = (node.textContent || "").replace(/\n+/g, " ");
        return "%60" + ct.replace(/%60/g, "\\%60") + "%60";
      }
      if (t === "pre") return "\n" + inline(node) + "\n";
      if (t === "blockquote") {
        const inner = block(node).trim().split("\n").join("\n> ");
        return "\n> " + inner + "\n";
      }
      if (t === "ul") {
        return "\n" + Array.from(node.children).map(li => " - " + liMd(li)).join("\n") + "\n";
      }
      if (t === "ol") {
        let idx = 1;
        return "\n" + Array.from(node.children).map(li => (idx++) + ". " + liMd(li)).join("\n") + "\n";
      }
      if (t === "li") return liMd(node);
      if (t === "a") {
        const href = node.getAttribute("href") || "";
        const txt = inline(node) || href;
        return "[" + txt + "](" + href + ")";
      }
      if (t === "img") {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        return "![" + alt + "](" + src + ")";
      }
      if (t === "table") return "\n" + tableMd(node) + "\n";

      return block(node);
    }
    function inline(el) { return Array.from(el.childNodes).map(walk).join(""); }
    function block(el) { return Array.from(el.childNodes).map(walk).join("").replace(/\n{3,}/g, "\n\n"); }
    function liMd(li) { return block(li).trim().replace(/\n/g, "\n   "); }
    function tableMd(tb) {
      const rows = Array.from(tb.querySelectorAll("tr")).map(tr =>
        Array.from(tr.children).map(td => block(td).trim())
      );
      if (!rows.length) return "";
      const head = rows[0];
      const sep = head.map(() => "--");
      const body = rows.slice(1);
      return [
        "| " + head.join(" | ") + " |",
        "| " + sep.join(" | ") + " |",
        ...body.map(r => "| " + r.join(" | ") + " |")
      ].join("\n");
    }

    let md = block(tmp).trim();
    for (let i = 0; i < codeBlocks.length; i++) {
      const c = codeBlocks[i];
      const fence = fenceFor(c.text);
      const blk =
        "\n" + fence + (c.lang ? " " + c.lang : "") + "\n" +
        repNL(c.text).replace(/\s+$/, "") + "\n" + fence + "\n";
      md = polyReplaceAll(md, "__CODE_" + i + "__", blk);
    }
    for (let j = 0; j < mBlocks.length; j++) {
      md = polyReplaceAll(md, "__MATHD_" + j + "__", "\n$$\n" + mBlocks[j] + "\n$$\n");
    }
    for (let k = 0; k < mInlines.length; k++) {
      md = polyReplaceAll(md, "__MATHI_" + k + "__", "$" + mInlines[k] + "$");
    }

    return md.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = filename;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sanitizeTitle(s) { return (s || "chatgpt").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60); }

  async function handleSelectedAnswerToMarkdown() {
    try {
      const ans = getAssistantContainer();
      if (!ans) { toast("请先在目标“回答”里用鼠标选中任意文字，再点按钮。", "warn", 2000); return; }
      const content = pickContentEl(ans);
      if (!content) { toast("未找到回答内容容器（.markdown）。页面结构可能更新。", "error", 2000); return; }

      const md = htmlToMd(content);
      if (!md) { toast("选中的回答似乎为空。", "warn", 2000); return; }

      await copyToClipboard(md);
      const safeTitle = sanitizeTitle(document.title);
      downloadText(`${safeTitle}-selected-answer.md`, md);

      toast("✅ 已复制并下载该条回答的 Markdown。", "info", 2000);
    } catch (err) {
      toast("执行异常：" + (err && err.message ? err.message : err), "error", 2500);
    }
  }

  // =============== FAB：圆形按钮（悬停展开 + 可拖动 + 记忆位置） ===============
  function injectStyle() {
    const s = document.createElement("style");
    s.textContent = `
      .gpt-fab {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 999999;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        height: 56px;
        width: 56px;                 /* 默认圆形 */
        padding: 0 18px;             /* 展开时用于文字留白 */
        border-radius: 999px;
        border: 1px solid ${theme.border};
        background: ${theme.bg};
        color: ${theme.text};
        box-shadow: ${theme.shadow};
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        cursor: pointer;
        user-select: none;
        transition: width .18s ease, background .18s ease, right .2s ease, bottom .2s ease;
        font: 500 14px/1.1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
      }
      .gpt-fab:hover { background: ${theme.bgHover}; width: 188px; }
      .gpt-fab__icon {
        flex: 0 0 auto;
        width: 26px; height: 26px;
        border-radius: 7px;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.06));
        border: 1px solid ${theme.border};
        box-shadow: inset 0 1px 1px rgba(255,255,255,.04);
        font-weight: 700;
        letter-spacing: .5px;
      }
      .gpt-fab__label {
        white-space: nowrap;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity .18s ease, transform .18s ease;
        color: ${theme.text};
      }
      .gpt-fab:hover .gpt-fab__label { opacity: 1; transform: translateX(0); }
      .gpt-fab::after {
        content: "";
        position: absolute; inset: 0;
        border-radius: inherit;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
        pointer-events: none;
      }
    `;
    document.documentElement.appendChild(s);
  }

  function createFab() {
    injectStyle();

    const btn = document.createElement("button");
    btn.className = "gpt-fab";
    btn.type = "button";
    btn.title = "选中回答 → 导出 Markdown（可拖动）";

    const icon = document.createElement("span");
    icon.className = "gpt-fab__icon";
    icon.textContent = "MD";
    btn.appendChild(icon);

    const label = document.createElement("span");
    label.className = "gpt-fab__label";
    label.textContent = "选中回答 → Markdown";
    btn.appendChild(label);

    // —— 防止拖拽后触发点击 —— //
    let dragging = false, moved = false, suppressClick = false;
    let startX = 0, startY = 0, startRight = 0, startBottom = 0;
    const DRAG_THRESHOLD = 6; // 移动超过 6px 认为是拖拽

    const savePos = () => {
      const rect = btn.getBoundingClientRect();
      const right = Math.max(10, window.innerWidth - rect.right);
      const bottom = Math.max(10, window.innerHeight - rect.bottom);
      localStorage.setItem(STORE_KEY, JSON.stringify({ right, bottom }));
    };

    const restorePos = () => {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      try {
        const { right, bottom } = JSON.parse(raw);
        if (typeof right === "number") btn.style.right = right + "px";
        if (typeof bottom === "number") btn.style.bottom = bottom + "px";
      } catch {}
    };

    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      btn.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startRight = parseFloat(getComputedStyle(btn).right);
      startBottom = parseFloat(getComputedStyle(btn).bottom);
      btn.style.width = "56px"; // 收起，避免展开状态拖动
      e.preventDefault();
    });

    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;
      btn.style.right = Math.max(6, startRight - dx) + "px";
      btn.style.bottom = Math.max(6, startBottom - dy) + "px";
    });

    window.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      btn.releasePointerCapture?.(e.pointerId);
      savePos();
      // 若发生过拖拽，则本次点击无效，且不弹任何提示
      if (moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 120);
      }
      setTimeout(() => { btn.style.width = ""; }, 50);
    });

    // 点击动作（考虑 suppressClick）
    btn.addEventListener("click", (e) => {
      if (suppressClick) return; // 拖拽后的“误点”被抑制
      handleSelectedAnswerToMarkdown();
    });

    restorePos();
    window.addEventListener("resize", () => {
      const rect = btn.getBoundingClientRect();
      if (rect.right > window.innerWidth) btn.style.right = "20px";
      if (rect.bottom > window.innerHeight) btn.style.bottom = "20px";
    });

    document.documentElement.appendChild(btn);
  }

  createFab();
})();