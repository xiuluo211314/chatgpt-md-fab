const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { htmlToMarkdown, resolveSelection } = require('../markdown');

function page(html) {
  return new JSDOM(html, { url: 'https://chatgpt.com/c/example' }).window;
}

function convert(html) {
  const window = page(`<main>${html}</main>`);
  try { return htmlToMarkdown(window.document.querySelector('main')); }
  finally { window.close(); }
}

test('headings, paragraphs and formatting are separated without changing the DOM', () => {
  const window = page('<main><h2>Title</h2>\n<p>Hello <strong>world</strong>.</p><p><em>Next</em></p></main>');
  const root = window.document.querySelector('main');
  const before = root.innerHTML;
  assert.equal(htmlToMarkdown(root), '## Title\n\nHello **world**.\n\n*Next*');
  assert.equal(root.innerHTML, before);
  window.close();
});

test('inline code uses valid delimiters and keeps boundary backticks and spaces', () => {
  assert.equal(convert('<p><code>/agent</code> <code>`x`</code> <code> a </code></p>'), '`/agent` `` `x` `` `  a  `');
});

test('literal Markdown characters stay literal', () => {
  assert.equal(convert('<p>*literal* [text] _x_ &lt;tag&gt;</p><p># heading</p><p>1. paragraph</p>'), '\\*literal\\* \\[text\\] \\_x\\_ \\<tag\\>\n\n\\# heading\n\n1\\. paragraph');
});

test('CodeMirror spans and br retain newlines, blank lines and trailing spaces', () => {
  assert.equal(convert('<pre><button>Copy</button><pre class="cm-content"><code><span>a  </span><br><br><br><span>  b</span><br></code></pre></pre>'), '```\na  \n\n\n  b\n```');
});

test('CodeMirror line DOM retains empty lines without adding placeholder br lines', () => {
  assert.equal(convert('<pre><div class="cm-content"><div class="cm-line">one</div><div class="cm-line"><br class="cm-placeholder"></div><div class="cm-line">  three</div></div></pre>'), '```\none\n\n  three\n```');
});

test('standalone CodeMirror editors without a pre wrapper are fenced', () => {
  assert.equal(convert('<div class="cm-editor"><div class="cm-gutters">1</div><div class="cm-content"><div class="cm-line">one</div><div class="cm-line">two</div></div></div>'), '```\none\ntwo\n```');
});

test('fences outgrow code backticks and language comes from classes', () => {
  assert.equal(convert('<pre><code class="language-md">```js\nx\n```</code></pre>'), '````md\n```js\nx\n```\n````');
});

test('language toolbar is read, but plain single-word code is not treated as language', () => {
  assert.equal(convert('<pre><div class="sticky">Python<button aria-label="Copy">Copy code</button></div><pre class="cm-content"><code>pass</code></pre></pre>'), '```python\npass\n```');
  assert.equal(convert('<pre><code>hello</code></pre>'), '```\nhello\n```');
});

test('math reads TeX exactly once and preserves dollar replacement syntax', () => {
  const formula = '<span class="katex"><annotation encoding="application/x-tex">x + $&amp;</annotation><span aria-hidden="true">duplicate</span></span>';
  assert.equal(convert(`<p>Inline ${formula}</p><div class="katex-display">${formula}</div>`), 'Inline $x + $&$\n\n$$\nx + $&\n$$');
});

test('nested lists indent under multi-digit ordered list content', () => {
  assert.equal(convert('<ol start="10"><li><p>Parent</p><ul><li>Child</li></ul><p>After</p></li><li>Next</li></ol>'), '10. Parent\n    \n    - Child\n    \n    After\n11. Next');
});

test('checkboxes and item value attributes are retained', () => {
  assert.equal(convert('<ul><li><input type="checkbox" checked>Done</li><li><input type="checkbox">Todo</li></ul><ol><li value="5">Five</li></ol>'), '- [x] Done\n- [ ] Todo\n\n5. Five');
});

test('code blocks nested in lists and quotes keep indentation and empty lines', () => {
  assert.equal(convert('<ul><li>Code<pre><code>a\n\n\nb</code></pre></li></ul><blockquote><p>Quote</p><pre><code>x\n\n\ny</code></pre></blockquote>'), '- Code\n  \n  ```\n  a\n  \n  \n  b\n  ```\n\n> Quote\n> \n> ```\n> x\n> \n> \n> y\n> ```');
});

test('tables escape pipes and line breaks and retain alignment', () => {
  assert.equal(convert('<table><tr><th align="right">A</th><th>B</th></tr><tr><td>x|y</td><td>one<br>two</td></tr></table>'), '| A | B |\n| ---: | --- |\n| x\\|y | one  <br>two |');
});

test('relative links, URL parentheses and images produce valid Markdown', () => {
  assert.equal(convert('<p><a href="/file(a)">File</a><img alt="[plot]" src="/plot.png"></p>'), '[File](https://chatgpt.com/file%28a%29)![\\[plot\\]](https://chatgpt.com/plot.png)');
  assert.equal(convert('<p><a href="javascript:alert(1)">unsafe</a></p>'), 'unsafe');
});

test('UI, hidden text and source favicon are omitted while citation links remain', () => {
  assert.equal(convert('<p>Answer <a href="https://example.com"><span aria-hidden="true"><img src="/icon.png"></span>Source</a></p><button>Copy</button><script>bad()</script><div hidden>Hidden</div><span class="sr-only">ChatGPT said</span>'), 'Answer [Source](https://example.com/)');
});

test('inline document and citation buttons keep their text, without inventing URLs', () => {
  assert.equal(convert('<p>See <button class="entity-underline">document</button> and <button class="citation-marker">[1]</button><button hidden class="entity-underline">Hidden</button></p>'), 'See document and \\[1\\]');
});

function select(window, start, end = start) {
  const range = window.document.createRange();
  range.setStart(start.firstChild, 0);
  range.setEnd(end.firstChild, end.firstChild.textContent.length);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return resolveSelection(selection);
}

test('selection locates assistant section and collects all response fragments once', () => {
  const window = page('<section data-turn="assistant"><div data-message-author-role="assistant"><div class="markdown"><p id="a">First</p><div class="markdown">Nested</div></div><div class="markdown">Second</div></div></section>');
  const answer = select(window, window.document.querySelector('#a'));
  assert.equal(answer.status, 'ok');
  assert.equal(answer.roots.length, 2);
  assert.equal(answer.roots.map(htmlToMarkdown).join('\n\n'), 'First\n\nNested\n\nSecond');
  window.close();
});

test('legacy assistant messages and new sections without role attributes work', () => {
  for (const html of ['<article data-testid="conversation-turn-1"><div data-message-author-role="assistant"><p id="a">Answer</p></div></article>', '<section data-turn="assistant"><div class="markdown"><p id="a">Answer</p></div></section>']) {
    const window = page(html);
    assert.equal(select(window, window.document.querySelector('#a')).status, 'ok');
    window.close();
  }
});

test('user messages, no selection, and selections crossing answers are rejected', () => {
  const window = page('<article data-testid="conversation-turn-1" data-turn="user"><p id="u">Question</p></article><section data-turn="assistant"><p id="a">Answer one</p></section><section data-turn="assistant"><p id="b">Answer two</p></section>');
  assert.equal(resolveSelection(window.getSelection()).status, 'no-selection');
  assert.equal(select(window, window.document.querySelector('#u')).status, 'not-assistant');
  assert.equal(select(window, window.document.querySelector('#a'), window.document.querySelector('#b')).status, 'multiple-answers');
  window.close();
});

test('old placeholder-shaped text and replacement dollar syntax survive unchanged', () => {
  assert.equal(convert('<pre><code>__CODE_BLOCK_0__ $&amp;\n\n\nlast</code></pre>'), '```\n__CODE_BLOCK_0__ $&\n\n\nlast\n```');
});
