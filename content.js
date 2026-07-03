(() => {
  if (window.__chatgpt_md_fab_injected__) return;
  window.__chatgpt_md_fab_injected__ = true;

  const STORE_KEY = "__chatgpt_md_fab_pos__";
  const OPTIONS = {
    // Set to true if you also want an .md file download after copying.
    downloadAfterCopy: false
  };

  const theme = (() => {
    const isDark = document.documentElement.classList.contains("dark")
      || window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;

    return isDark
      ? {
          bg: "#2a2b32",
          bgHover: "#32333b",
          border: "#3a3b44",
          text: "#e8e9ee",
          info: "#60a5fa",
          warn: "#f59e0b",
          error: "#ef4444",
          shadow: "0 10px 22px rgba(0,0,0,.35)"
        }
      : {
          bg: "#1f2937",
          bgHover: "#263042",
          border: "#394456",
          text: "#eef2ff",
          info: "#2563eb",
          warn: "#d97706",
          error: "#dc2626",
          shadow: "0 10px 22px rgba(0,0,0,.25)"
        };
  })();

  function ensureToastHost() {
    let host = document.querySelector(".gpt-md-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "gpt-md-toast-host";

      const style = document.createElement("style");
      style.textContent = `
        .gpt-md-toast-host {
          position: fixed;
          right: 20px;
          bottom: 90px;
          z-index: 1000000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .gpt-md-toast {
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
        .gpt-md-toast.show {
          opacity: 1;
          transform: translateY(0);
        }
        .gpt-md-toast__bar {
          border-radius: 10px;
        }
        .gpt-md-toast__content {
          white-space: pre-wrap;
          word-break: break-word;
        }
      `;

      document.documentElement.appendChild(style);
      document.documentElement.appendChild(host);
    }
    return host;
  }

  function toast(message, type = "info", duration = 2000) {
    const host = ensureToastHost();
    const node = document.createElement("div");
    node.className = "gpt-md-toast";

    const bar = document.createElement("div");
    bar.className = "gpt-md-toast__bar";
    bar.style.background = type === "error" ? theme.error : type === "warn" ? theme.warn : theme.info;

    const content = document.createElement("div");
    content.className = "gpt-md-toast__content";
    content.textContent = message;

    node.appendChild(bar);
    node.appendChild(content);
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));

    const remove = () => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 200);
    };
    const timer = setTimeout(remove, Math.max(800, duration));
    node.addEventListener("click", () => {
      clearTimeout(timer);
      remove();
    });
  }

  function toElement(node) {
    return node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  }

  function getAssistantContainer() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const start = toElement(range.startContainer);
    const end = toElement(range.endContainer);
    const common = toElement(range.commonAncestorContainer);

    const selectors = [
      '[data-message-author-role="assistant"]',
      'section[data-turn="assistant"]',
      '[data-testid^="conversation-turn-"]'
    ].join(",");

    return start?.closest?.(selectors)
      || end?.closest?.(selectors)
      || common?.closest?.(selectors)
      || null;
  }

  function pickContentElement(container) {
    if (!container) return null;
    return container.querySelector('[data-message-author-role="assistant"] .markdown')
      || container.querySelector(".markdown")
      || container.querySelector('[data-message-author-role="assistant"]')
      || container;
  }

  function normalizeNewlines(value) {
    return (value || "").replace(/\r\n?/g, "\n");
  }

  function collapseBlankLines(value) {
    return normalizeNewlines(value)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function escapeInlineCode(value) {
    const text = normalizeNewlines(value).replace(/\s+/g, " ").trim();
    if (!text) return "";
    const ticks = text.match(/`+/g) || [];
    const fence = "`".repeat(Math.max(1, ...ticks.map(t => t.length)) + 1);
    return `${fence}${text}${fence}`;
  }

  function fenceFor(code) {
    const ticks = code.match(/`+/g) || [];
    return "`".repeat(Math.max(3, ...ticks.map(t => t.length + 1)));
  }

  function textWithBreaks(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "\n";

    return Array.from(node.childNodes).map(textWithBreaks).join("");
  }

  function detectLanguage(pre, code) {
    const className = `${pre.className || ""} ${code?.className || ""}`;
    const classMatch = className.match(/(?:language|lang)-([\w#+.-]+)/i);
    if (classMatch) return classMatch[1].toLowerCase();

    const label = Array.from(pre.querySelectorAll("div,span"))
      .filter(el => !el.closest("code"))
      .map(el => (el.childElementCount <= 2 ? el.textContent.trim() : ""))
      .find(text => /^[a-z][\w#+.-]{0,24}$/i.test(text) && !/^(copy|复制|copied|已复制)$/i.test(text));

    return label ? label.toLowerCase() : "";
  }

  function extractCodeBlock(pre) {
    const code = pre.querySelector("pre.cm-content code, .cm-content code, code");
    const source = code || pre;
    const text = textWithBreaks(source).replace(/\u00a0/g, " ").replace(/\n+$/g, "");
    return {
      lang: detectLanguage(pre, code),
      text
    };
  }

  function escapeTableCell(value) {
    return collapseBlankLines(value)
      .replace(/\|/g, "\\|")
      .replace(/\n/g, "<br>");
  }

  function htmlToMarkdown(root) {
    const tmp = root.cloneNode(true);

    const codeBlocks = [];
    Array.from(tmp.querySelectorAll("pre"))
      .filter(pre => !pre.parentElement?.closest("pre"))
      .forEach(pre => {
        const key = `\n\n__CODE_BLOCK_${codeBlocks.length}__\n\n`;
        codeBlocks.push(extractCodeBlock(pre));
        pre.replaceWith(document.createTextNode(key));
      });

    const mathBlocks = [];
    Array.from(tmp.querySelectorAll(".katex-display")).forEach(el => {
      const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim() || "";
      const key = `__MATH_BLOCK_${mathBlocks.length}__`;
      mathBlocks.push(tex);
      el.replaceWith(document.createTextNode(key));
    });

    const mathInlines = [];
    Array.from(tmp.querySelectorAll(".katex:not(.katex-display)")).forEach(el => {
      const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim() || "";
      const key = `__MATH_INLINE_${mathInlines.length}__`;
      mathInlines.push(tex);
      el.replaceWith(document.createTextNode(key));
    });

    Array.from(tmp.querySelectorAll([
      "button",
      "svg",
      "form",
      "nav",
      "header",
      "footer",
      "[contenteditable]",
      ".sr-only",
      "[aria-hidden='true']",
      "[data-testid='copy-turn-action-button']"
    ].join(","))).forEach(el => el.remove());

    function inline(node) {
      return Array.from(node.childNodes).map(walk).join("");
    }

    function block(node) {
      return Array.from(node.childNodes).map(walk).join("");
    }

    function listItem(li, depth) {
      const childLists = Array.from(li.children).filter(child => /^(ul|ol)$/i.test(child.tagName));
      const clone = li.cloneNode(true);
      Array.from(clone.children).filter(child => /^(ul|ol)$/i.test(child.tagName)).forEach(child => child.remove());

      const main = collapseBlankLines(block(clone)).replace(/\n/g, `\n${"  ".repeat(depth + 1)}`);
      const nested = childLists.map(list => listMarkdown(list, depth + 1)).join("");
      return main + nested;
    }

    function listMarkdown(list, depth = 0) {
      const ordered = list.tagName.toLowerCase() === "ol";
      let index = Number.parseInt(list.getAttribute("start") || "1", 10);
      if (!Number.isFinite(index)) index = 1;

      const rows = Array.from(list.children)
        .filter(child => child.tagName?.toLowerCase() === "li")
        .map(li => {
          const marker = ordered ? `${index++}. ` : "- ";
          return `${"  ".repeat(depth)}${marker}${listItem(li, depth)}`;
        });

      return `\n${rows.join("\n")}\n`;
    }

    function tableMarkdown(table) {
      const rows = Array.from(table.querySelectorAll("tr")).map(tr =>
        Array.from(tr.children).map(cell => escapeTableCell(block(cell)))
      ).filter(row => row.length);

      if (!rows.length) return "";
      const width = Math.max(...rows.map(row => row.length));
      const normalized = rows.map(row => Array.from({ length: width }, (_, i) => row[i] || ""));
      const header = normalized[0];
      const separator = header.map(() => "---");
      const body = normalized.slice(1);

      return [
        `| ${header.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...body.map(row => `| ${row.join(" | ")} |`)
      ].join("\n");
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();
      if (tag === "br") return "\n";
      if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${collapseBlankLines(inline(node))}\n\n`;
      if (tag === "p") return `\n\n${collapseBlankLines(inline(node))}\n\n`;
      if (tag === "strong" || tag === "b") return `**${inline(node)}**`;
      if (tag === "em" || tag === "i") return `*${inline(node)}*`;
      if (tag === "del" || tag === "s") return `~~${inline(node)}~~`;
      if (tag === "code") return escapeInlineCode(node.textContent || "");
      if (tag === "blockquote") {
        const quoted = collapseBlankLines(block(node)).split("\n").map(line => `> ${line}`).join("\n");
        return `\n\n${quoted}\n\n`;
      }
      if (tag === "ul" || tag === "ol") return listMarkdown(node);
      if (tag === "li") return listItem(node, 0);
      if (tag === "hr") return "\n\n---\n\n";
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        const text = collapseBlankLines(inline(node)) || href;
        return href && text !== href ? `[${text}](${href})` : text;
      }
      if (tag === "img") {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        return src ? `![${alt}](${src})` : "";
      }
      if (tag === "table") return `\n\n${tableMarkdown(node)}\n\n`;

      return block(node);
    }

    let markdown = collapseBlankLines(block(tmp));

    codeBlocks.forEach((code, index) => {
      const fence = fenceFor(code.text);
      const lang = code.lang ? code.lang.replace(/[^\w#+.-]/g, "") : "";
      const blockText = `${fence}${lang}\n${normalizeNewlines(code.text)}\n${fence}`;
      markdown = markdown.replace(`__CODE_BLOCK_${index}__`, blockText);
    });

    mathBlocks.forEach((tex, index) => {
      markdown = markdown.replace(`__MATH_BLOCK_${index}__`, `$$\n${tex}\n$$`);
    });

    mathInlines.forEach((tex, index) => {
      markdown = markdown.replace(`__MATH_INLINE_${index}__`, `$${tex}$`);
    });

    return collapseBlankLines(markdown);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  function sanitizeTitle(value) {
    return (value || "chatgpt").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  }

  function clearSelection() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }

  async function handleSelectedAnswerToMarkdown() {
    try {
      const container = getAssistantContainer();
      if (!container) {
        toast("请先在目标回答中选中任意文字，再点击 MD。", "warn", 2000);
        return;
      }

      const content = pickContentElement(container);
      if (!content) {
        toast("未找到回答内容容器，ChatGPT 页面结构可能已更新。", "error", 2200);
        return;
      }

      const markdown = htmlToMarkdown(content);
      if (!markdown) {
        toast("选中的回答内容为空。", "warn", 2000);
        return;
      }

      const copied = await copyToClipboard(markdown);
      if (OPTIONS.downloadAfterCopy) {
        downloadText(`${sanitizeTitle(document.title)}-selected-answer.md`, markdown);
      }
      toast(
        copied
          ? (OPTIONS.downloadAfterCopy ? "已复制并下载 Markdown。" : "已复制 Markdown。")
          : (OPTIONS.downloadAfterCopy ? "已下载 Markdown，但剪贴板写入失败。" : "剪贴板写入失败。"),
        copied ? "info" : "warn",
        2200
      );
      clearSelection();
    } catch (err) {
      toast(`执行异常：${err?.message || err}`, "error", 2800);
    }
  }

  function injectStyle() {
    const style = document.createElement("style");
    style.textContent = `
      .gpt-md-fab {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 999999;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        height: 56px;
        width: 56px;
        padding: 0 18px;
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
        font: 700 14px/1.1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
      }
      .gpt-md-fab:hover {
        background: ${theme.bgHover};
        width: 176px;
      }
      .gpt-md-fab__icon {
        flex: 0 0 auto;
        width: 26px;
        height: 26px;
        border-radius: 7px;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08));
        border: 1px solid ${theme.border};
        box-shadow: inset 0 1px 1px rgba(255,255,255,.04);
        letter-spacing: .5px;
      }
      .gpt-md-fab__label {
        white-space: nowrap;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity .18s ease, transform .18s ease;
      }
      .gpt-md-fab:hover .gpt-md-fab__label {
        opacity: 1;
        transform: translateX(0);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function createFab() {
    injectStyle();

    const button = document.createElement("button");
    button.className = "gpt-md-fab";
    button.type = "button";
    button.title = "选中回答，导出 Markdown";

    const icon = document.createElement("span");
    icon.className = "gpt-md-fab__icon";
    icon.textContent = "MD";
    button.appendChild(icon);

    const label = document.createElement("span");
    label.className = "gpt-md-fab__label";
    label.textContent = "导出 Markdown";
    button.appendChild(label);

    let dragging = false;
    let moved = false;
    let suppressClick = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    const dragThreshold = 6;

    const savePos = () => {
      const rect = button.getBoundingClientRect();
      const right = Math.max(10, window.innerWidth - rect.right);
      const bottom = Math.max(10, window.innerHeight - rect.bottom);
      localStorage.setItem(STORE_KEY, JSON.stringify({ right, bottom }));
    };

    const restorePos = () => {
      try {
        const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
        if (!value) return;
        if (typeof value.right === "number") button.style.right = `${value.right}px`;
        if (typeof value.bottom === "number") button.style.bottom = `${value.bottom}px`;
      } catch {}
    };

    button.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      dragging = true;
      moved = false;
      button.setPointerCapture(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
      startRight = Number.parseFloat(getComputedStyle(button).right);
      startBottom = Number.parseFloat(getComputedStyle(button).bottom);
      button.style.width = "56px";
      event.preventDefault();
    });

    window.addEventListener("pointermove", event => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) moved = true;
      button.style.right = `${Math.max(6, startRight - dx)}px`;
      button.style.bottom = `${Math.max(6, startBottom - dy)}px`;
    });

    window.addEventListener("pointerup", event => {
      if (!dragging) return;
      dragging = false;
      button.releasePointerCapture?.(event.pointerId);
      savePos();
      if (moved) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 120);
      }
      setTimeout(() => {
        button.style.width = "";
      }, 50);
    });

    button.addEventListener("click", () => {
      if (!suppressClick) handleSelectedAnswerToMarkdown();
    });

    restorePos();
    window.addEventListener("resize", () => {
      const rect = button.getBoundingClientRect();
      if (rect.right > window.innerWidth) button.style.right = "20px";
      if (rect.bottom > window.innerHeight) button.style.bottom = "20px";
    });

    document.documentElement.appendChild(button);
  }

  createFab();
  clearSelection();
})();
