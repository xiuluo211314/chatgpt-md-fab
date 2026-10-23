const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { htmlToMarkdown, resolveSelection } = require('../markdown');

// Sanitized structural fixture based on the supplied October 2026 HTML export.
const html = fs.readFileSync(path.join(__dirname, 'fixtures/current-chatgpt.html'), 'utf8');

function selected(window, start, end = start) {
  const range = window.document.createRange();
  range.setStart(start.firstChild, 0);
  range.setEnd(end.firstChild, end.firstChild.length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  return resolveSelection(window.getSelection());
}

test('current search-unit markers locate the answer without legacy attributes', () => {
  const window = new JSDOM(html, { url: 'https://chatgpt.com/c/test' }).window;
  try {
    assert.equal(window.document.querySelector('.markdown, [data-message-author-role], [data-turn]'), null);
    const result = selected(window, window.document.querySelector('#answer'));
    assert.equal(result.status, 'ok');
    assert.equal(result.roots.length, 1);
    assert.equal(result.turn.getAttribute('data-chatgpt-search-unit-key'), 'fallback-turn-1:2:assistant');
    const output = result.roots.map(htmlToMarkdown).join('\n\n');
    assert.match(output, /^## Answer title\n\nSelected answer \*\*bold\*\* and \*italic\*\./);
    assert.match(output, /Inline \$q\(s\)\$\./);
    assert.ok(output.includes('$$\nq = r_0 - \\delta\n$$'));
    assert.ok(output.includes('```python\nq = 1\n\nprint(q)\n```'));
    assert.ok(output.includes('| Symbol | Meaning |\n| --- | --- |\n| q | Offset |'));
    assert.doesNotMatch(output, /User question|Hidden reasoning|Timestamp|Answer toolbar|Copy code|Run|duplicate|Different assistant/);
  } finally { window.close(); }
});

test('current user messages are rejected and assistant units do not merge across a turn', () => {
  const window = new JSDOM(html).window;
  try {
    assert.equal(selected(window, window.document.querySelector('#question')).status, 'not-assistant');
    assert.equal(selected(window, window.document.querySelector('#answer'), window.document.querySelector('#other-answer')).status, 'multiple-answers');
    assert.equal(selected(window, window.document.querySelector('#other-answer')).status, 'ok');
  } finally { window.close(); }
});

test('assistant message-style fallback collects fragments without exporting neighboring questions', () => {
  const window = new JSDOM('<div data-turn-key="mixed"><div data-user-message-bubble>Question</div><div data-chatgpt-selection-message-id="a"><div data-markdown-text-style="assistant-message"><p id="a">First</p></div><div data-markdown-text-style="assistant-message"><p id="b">Second</p></div></div></div>').window;
  try {
    const result = selected(window, window.document.querySelector('#a'), window.document.querySelector('#b'));
    assert.equal(result.status, 'ok');
    assert.equal(result.roots.map(htmlToMarkdown).join('\n\n'), 'First\n\nSecond');
  } finally { window.close(); }
});

test('copy-content wrappers work without the message-style attribute', () => {
  const window = new JSDOM('<div data-content-search-unit-key="turn:assistant"><div data-markdown-copy="contents"><p id="a">Answer</p></div><div data-markdown-copy="exclude">Toolbar</div></div>').window;
  try {
    const result = selected(window, window.document.querySelector('#a'));
    assert.equal(result.status, 'ok');
    assert.equal(result.roots.map(htmlToMarkdown).join('\n\n'), 'Answer');
  } finally { window.close(); }
});
