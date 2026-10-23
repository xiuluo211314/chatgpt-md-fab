const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { JSDOM } = require('jsdom');
const { htmlToMarkdown } = require('../markdown');

// An optional local HTML sample is read only; its content is never printed or uploaded.
const html = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : `<main class="markdown">${Array.from({ length: 80 }, (_, i) => `
  <h2>Section ${i + 1}</h2><p>Text with <strong>formatting</strong>, <code>/agent</code> and a <a href="https://example.com">source</a>.</p>
  <ol start="10"><li><p>Parent</p><ul><li>Child</li></ul></li></ol>
  <pre><div class="sticky">Python<button>Copy</button></div><div class="cm-content"><div class="cm-line">def example():</div><div class="cm-line"><br></div><div class="cm-line">    return ${i}</div></div></pre>
  <table><tr><th>A</th><th>B</th></tr><tr><td>One</td><td>Two</td></tr></table>`).join('')}</main>`;
const window = new JSDOM(html, { url: 'https://chatgpt.com/c/benchmark' }).window;
try {
  const root = Array.from(window.document.querySelectorAll('.markdown, [data-markdown-text-style="assistant-message"]'))
    .find(node => !node.closest('[hidden], [aria-hidden="true"]')) || window.document.body;
  for (let i = 0; i < 3; i++) htmlToMarkdown(root);
  const times = [];
  let output;
  for (let i = 0; i < 12; i++) {
    const start = performance.now();
    output = htmlToMarkdown(root);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ environment: 'Node + jsdom (not Chrome)', elements: root.querySelectorAll('*').length,
    markdownCharacters: output.length, iterations: times.length,
    medianMs: Number(times[Math.floor(times.length / 2)].toFixed(2)), p95Ms: Number(times[Math.ceil(times.length * .95) - 1].toFixed(2)) }, null, 2));
} finally { window.close(); }
