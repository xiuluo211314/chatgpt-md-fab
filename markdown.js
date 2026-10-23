(function (global) {
  "use strict";

  const ASSISTANT = '[data-message-author-role="assistant"], [data-turn="assistant"]';
  const TURN = '[data-turn], [data-testid^="conversation-turn-"], article';
  const OMIT = 'script, style, template, svg, button, form, nav, header, footer, .sr-only, [hidden], [aria-hidden="true"], [data-message-author-role="user"]';

  function element(node) {
    return node?.nodeType === 1 ? node : node?.parentElement;
  }

  function assistantAt(node) {
    const el = element(node);
    if (!el || el.closest('[data-message-author-role="user"], [data-turn="user"]')) return null;
    const assistant = el.closest(ASSISTANT);
    if (assistant) return assistant.closest(TURN) || assistant;
    const turn = el.closest(TURN);
    return turn?.querySelector('[data-message-author-role="assistant"]') ? turn : null;
  }

  function contentRoots(turn) {
    const messages = turn.matches('[data-message-author-role="assistant"]')
      ? [turn] : Array.from(turn.querySelectorAll('[data-message-author-role="assistant"]'));
    const sources = messages.length ? messages : [turn];
    return sources.flatMap(source => {
      const roots = source.matches('.markdown, [data-message-content]')
        ? [source] : Array.from(source.querySelectorAll('.markdown, [data-message-content]'));
      return roots.length ? roots.filter(root => !roots.some(other => other !== root && other.contains(root))) : [source];
    });
  }

  function resolveSelection(selection) {
    if (!selection || !selection.rangeCount || selection.isCollapsed) return { status: "no-selection" };
    let answer = null;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const start = assistantAt(range.startContainer);
      const end = assistantAt(range.endContainer);
      if (!start || !end) return { status: "not-assistant" };
      if (start !== end || (answer && answer !== start)) return { status: "multiple-answers" };
      answer = start;
    }
    return { status: "ok", turn: answer, roots: contentRoots(answer) };
  }

  function normalize(value) {
    return value.replace(/\r\n?/g, "\n");
  }

  // Merge only adjacent block boundaries. Never rewrite whitespace inside code or math.
  function join(parts) {
    let result = "";
    for (const part of parts) {
      if (!part) continue;
      const left = result.endsWith("\n") ? result.match(/\n+$/)[0].length : 0;
      const right = part.startsWith("\n") ? part.match(/^\n+/)[0].length : 0;
      result = left && right
        ? result.slice(0, -left) + "\n".repeat(Math.min(2, Math.max(left, right))) + part.slice(right)
        : result + part;
    }
    return result;
  }

  function inlineCode(value) {
    const text = normalize(value).replace(/\n/g, " ");
    if (!text) return "";
    const ticks = Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length));
    const fence = "`".repeat(ticks + 1);
    const pad = /^`|`$/.test(text) || (/^ .* $/.test(text) && /[^ ]/.test(text)) ? " " : "";
    return fence + pad + text + pad + fence;
  }

  function codeText(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 || node.matches('button, svg, .cm-gutters, .cm-tooltip')) return "";
    if (node.tagName === "BR") return "\n";
    const lines = Array.from(node.children).filter(child => child.matches('.cm-line'));
    if (lines.length) return lines.map(line => line.childNodes.length === 1 && line.firstChild.nodeName === "BR" ? "" : codeText(line)).join("\n");
    return Array.from(node.childNodes, codeText).join("");
  }

  function codeBlock(pre) {
    const source = pre.matches('.cm-content') ? pre : pre.querySelector('.cm-content') || pre.querySelector('code') || pre;
    let text = normalize(codeText(source)).replace(/\u00a0/g, " ");
    if (text.endsWith("\n")) text = text.slice(0, -1);
    const classes = `${pre.className} ${source.className} ${pre.querySelector('code')?.className || ""}`;
    let language = classes.match(/(?:language|lang)-([\w#+.-]+)/i)?.[1] || pre.getAttribute('data-language') || "";
    if (!language) {
      const labels = pre.querySelectorAll('[data-language], .sticky, .select-none');
      for (const label of labels) {
        if (source.contains(label) || label.contains(source)) continue;
        const value = (label.getAttribute('data-language') || codeText(label)).trim();
        if (/^[a-z][\w#+.-]{0,24}$/i.test(value) && !/^(copy|copied|run|edit)$/i.test(value)) {
          language = value;
          break;
        }
      }
    }
    const fence = "`".repeat(Math.max(3, ...(text.match(/`+/g) || []).map(run => run.length + 1)));
    return `\n\n${fence}${language.replace(/[^\w#+.-]/g, "").toLowerCase()}\n${text}\n${fence}\n\n`;
  }

  function escapeText(value) {
    return value.replace(/\s+/g, " ").replace(/([\\`*_[\]<>~])/g, "\\$1");
  }

  function destination(value, baseURI) {
    if (!value) return "";
    try {
      const url = new URL(value, baseURI);
      if (!/^(https?:|mailto:|blob:|data:)/.test(url.protocol)) return "";
      return url.href.replace(/[()\\<>\s]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    } catch {
      return "";
    }
  }

  function htmlToMarkdown(root) {
    const baseURI = root.ownerDocument.baseURI;
    const children = node => join(Array.from(node.childNodes, walk));
    const block = text => text ? `\n\n${text}\n\n` : "";
    const clean = text => text.trim().replace(/^(#{1,6}|>|[-+])(?=\s)/, "\\$1").replace(/^(\d+)[.)](?=\s)/, "$1\\.");

    function listMarkdown(list) {
      const ordered = list.tagName === "OL";
      let index = Number.parseInt(list.getAttribute('start') || "1", 10);
      if (!Number.isFinite(index)) index = 1;
      const rows = Array.from(list.children).filter(child => child.tagName === "LI").map(li => {
        if (li.hasAttribute('value')) index = Number.parseInt(li.getAttribute('value'), 10) || index;
        const marker = ordered ? `${index++}. ` : "- ";
        const checkbox = li.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
        const task = checkbox ? (checkbox.checked ? "[x] " : "[ ] ") : "";
        const text = children(li).trim();
        return marker + task + text.replace(/\n/g, "\n" + " ".repeat(marker.length));
      });
      return block(rows.join("\n"));
    }

    function tableMarkdown(table) {
      const rows = Array.from(table.rows, row => Array.from(row.cells, cell => children(cell).trim()
        .replace(/\|/g, "\\|").replace(/\n+/g, "<br>"))).filter(row => row.length);
      if (!rows.length) return "";
      const width = Math.max(...rows.map(row => row.length));
      const normalized = rows.map(row => Array.from({ length: width }, (_, i) => row[i] || ""));
      const separator = Array.from({ length: width }, (_, i) => {
        const cell = table.rows[0]?.cells[i];
        const align = cell?.getAttribute('align') || cell?.style.textAlign;
        return align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---";
      });
      return block([normalized[0], separator, ...normalized.slice(1)].map(row => `| ${row.join(" | ")} |`).join("\n"));
    }

    function walk(node) {
      if (node.nodeType === 3) {
        if (/^\s*\n\s*$/.test(node.nodeValue)
          && [node.previousSibling, node.nextSibling].some(sibling => sibling?.nodeType === 1
            && /^(H[1-6]|P|DIV|SECTION|PRE|UL|OL|TABLE|BLOCKQUOTE|HR)$/.test(sibling.tagName))) return "";
        return escapeText(node.nodeValue);
      }
      if (node.nodeType !== 1) return "";
      const tag = node.tagName;
      // Formula source must be read before skipping its aria-hidden rendered layers.
      if (node.matches('.katex-display, .katex, math, [data-math]')) {
        const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent
          || node.getAttribute('data-math');
        if (tex) return node.matches('.katex-display, [display="block"]') ? block(`$$\n${tex.trim()}\n$$`) : `$${tex.trim()}$`;
      }
      if (tag === "BUTTON" && node.matches('.entity-underline, .citation-marker')
        && !node.matches('[hidden], [aria-hidden="true"]')) return children(node).trim();
      if (node.matches(OMIT)) return "";
      if (tag === "PRE" || node.matches('.cm-editor, .cm-content')) return codeBlock(node);
      if (tag === "CODE") return inlineCode(node.textContent);
      if (tag === "BR") return "  \n";
      if (tag === "INPUT") return "";
      if (tag === "HR") return block("---");
      if (/^H[1-6]$/.test(tag)) return block(`${"#".repeat(Number(tag[1]))} ${children(node).trim()}`);
      if (tag === "P") return block(clean(children(node)));
      if (tag === "UL" || tag === "OL") return listMarkdown(node);
      if (tag === "BLOCKQUOTE") return block(children(node).trim().split("\n").map(line => `> ${line}`).join("\n"));
      if (tag === "TABLE") return tableMarkdown(node);
      if (tag === "A") {
        const text = children(node).trim();
        const href = destination(node.getAttribute('href'), baseURI);
        return href ? `[${text || escapeText(href)}](${href})` : text;
      }
      if (tag === "IMG") {
        const src = destination(node.getAttribute('src'), baseURI);
        return src ? `![${escapeText(node.getAttribute('alt') || "")}](${src})` : "";
      }
      const text = children(node);
      if (tag === "STRONG" || tag === "B" || tag === "EM" || tag === "I" || tag === "DEL" || tag === "S") {
        const marker = /^(STRONG|B)$/.test(tag) ? "**" : /^(DEL|S)$/.test(tag) ? "~~" : "*";
        return text.trim() ? text.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, before, body, after) => `${before}${marker}${body}${marker}${after}`) : text;
      }
      if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "FIGURE" || tag === "FIGCAPTION") return block(text.trim());
      return text;
    }

    return children(root).trim();
  }

  const api = Object.freeze({ htmlToMarkdown, resolveSelection });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.ChatGPTMarkdown = api;
})(globalThis);
