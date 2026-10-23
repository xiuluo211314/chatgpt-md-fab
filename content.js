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
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");

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
          box-sizing: border-box;
          min-width: min(220px, calc(100vw - 40px));
          max-width: min(420px, calc(100vw - 40px));
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

  const { htmlToMarkdown, resolveSelection } = globalThis.ChatGPTMarkdown;

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const selection = window.getSelection();
      const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
      const active = document.activeElement;
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        textarea.remove();
        active?.focus?.({ preventScroll: true });
        selection?.removeAllRanges();
        ranges.forEach(range => selection?.addRange(range));
      }
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sanitizeTitle(value) {
    return (value || "chatgpt").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  }

  function clearSelection() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }

  let exporting = false;

  async function handleSelectedAnswerToMarkdown(button, target) {
    if (exporting) return;
    try {
      const answer = target || resolveSelection(window.getSelection());
      if (answer.status !== "ok" || !answer.turn.isConnected) {
        const messages = {
          "multiple-answers": "请只在同一条助手回答内选择文字。",
          "not-assistant": "请选中助手回答中的文字，不能选择用户消息。"
        };
        toast(messages[answer.status] || "请先在目标回答中选中任意文字，再点击 MD。", "warn");
        return;
      }

      exporting = true;
      button.setAttribute("aria-busy", "true");
      const markdown = answer.roots.map(htmlToMarkdown).filter(Boolean).join("\n\n");
      if (!markdown) {
        toast("选中的回答内容为空。", "warn");
        return;
      }

      const copied = await copyToClipboard(markdown);
      if (OPTIONS.downloadAfterCopy) {
        downloadText(`${sanitizeTitle(document.title)}-selected-answer.md`, markdown);
      }
      toast(
        copied
          ? (OPTIONS.downloadAfterCopy ? "已复制并下载 Markdown。" : "已复制 Markdown。")
          : (OPTIONS.downloadAfterCopy ? "已下载 Markdown，但剪贴板写入失败。" : "剪贴板写入失败，请重试。"),
        copied ? "info" : "warn",
        2200
      );
      if (copied) clearSelection();
    } catch (err) {
      toast(`执行异常：${err?.message || err}`, "error", 2800);
    } finally {
      exporting = false;
      button.removeAttribute("aria-busy");
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
        box-sizing: border-box;
        display: grid;
        place-items: center;
        height: 56px;
        width: 56px;
        padding: 0;
        border-radius: 50%;
        border: 1px solid ${theme.border};
        background: ${theme.bg};
        color: ${theme.text};
        box-shadow: ${theme.shadow};
        cursor: pointer;
        user-select: none;
        touch-action: none;
        font: 700 14px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }
      .gpt-md-fab:hover { background: ${theme.bgHover}; }
      .gpt-md-fab:focus-visible { outline: 2px solid ${theme.info}; outline-offset: 3px; }
      .gpt-md-fab[aria-busy="true"] { cursor: progress; opacity: .7; }
      .gpt-md-fab__icon { pointer-events: none; }
      @media (prefers-reduced-motion: reduce) {
        .gpt-md-toast { transition: none; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function createFab() {
    injectStyle();

    const button = document.createElement("button");
    button.className = "gpt-md-fab";
    button.type = "button";
    button.title = "选中助手回答中的文字，复制整条回答为 Markdown；拖动可调整位置";
    button.setAttribute("aria-label", "复制选中的助手回答为 Markdown");

    const icon = document.createElement("span");
    icon.className = "gpt-md-fab__icon";
    icon.textContent = "MD";
    button.appendChild(icon);

    let drag = null;
    let suppressClick = false;
    let selectedAnswer = null;

    const clampPosition = (right, bottom) => {
      const margin = 6;
      button.style.right = `${Math.max(margin, Math.min(right, window.innerWidth - 56 - margin))}px`;
      button.style.bottom = `${Math.max(margin, Math.min(bottom, window.innerHeight - 56 - margin))}px`;
    };

    const savePos = () => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          right: Number.parseFloat(button.style.right) || 20,
          bottom: Number.parseFloat(button.style.bottom) || 20
        }));
      } catch {}
    };

    button.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !event.isPrimary) return;
      selectedAnswer = resolveSelection(window.getSelection());
      suppressClick = false;
      const rect = button.getBoundingClientRect();
      drag = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom,
        moved: false
      };
      button.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    button.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) clampPosition(drag.right - dx, drag.bottom - dy);
    });

    const finishDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      suppressClick = drag.moved || event.type === "pointercancel";
      if (drag.moved) savePos();
      drag = null;
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener("pointerup", finishDrag);
    button.addEventListener("pointercancel", finishDrag);
    button.addEventListener("lostpointercapture", event => {
      if (drag?.id === event.pointerId) {
        drag = null;
        suppressClick = true;
        selectedAnswer = null;
      }
    });

    button.addEventListener("click", event => {
      const answer = event.detail === 0 ? null : selectedAnswer;
      selectedAnswer = null;
      if (event.detail === 0 || !suppressClick) handleSelectedAnswerToMarkdown(button, answer);
      suppressClick = false;
    });

    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch {}
    clampPosition(Number.isFinite(saved?.right) ? saved.right : 20, Number.isFinite(saved?.bottom) ? saved.bottom : 20);
    window.addEventListener("resize", () => {
      clampPosition(Number.parseFloat(button.style.right), Number.parseFloat(button.style.bottom));
    });
    document.documentElement.appendChild(button);
  }

  createFab();
})();
