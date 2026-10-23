const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setup(options = {}) {
  const window = new JSDOM('<section data-turn="assistant"><div data-message-author-role="assistant"><div class="markdown"><p id="answer">Full answer <code>/agent</code></p></div></div></section>', {
    url: 'https://chatgpt.com/c/test', runScripts: 'outside-only', pretendToBeVisual: true
  }).window;
  const { document } = window;
  const copies = [];
  let downloads = 0;
  window.matchMedia = () => ({ matches: false });
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async text => {
    copies.push(text);
    if (options.clipboard) return options.clipboard(text);
  } } });
  window.URL.createObjectURL = () => { downloads++; return 'blob:test'; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLElement.prototype.setPointerCapture = function () { this.captured = true; };
  window.HTMLElement.prototype.hasPointerCapture = function () { return Boolean(this.captured); };
  window.HTMLElement.prototype.releasePointerCapture = function () { this.captured = false; };
  if (options.storageBlocked) window.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  const range = document.createRange();
  range.setStart(document.querySelector('#answer').firstChild, 0);
  range.setEnd(document.querySelector('#answer').firstChild, 4);
  window.getSelection().addRange(range);
  const markdownScript = fs.readFileSync(path.join(__dirname, '../markdown.js'), 'utf8');
  let contentScript = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
  if (options.download) contentScript = contentScript.replace('downloadAfterCopy: false', 'downloadAfterCopy: true');
  window.eval(markdownScript);
  window.eval(contentScript);
  return {
    window, document, copies, button: document.querySelector('.gpt-md-fab'),
    downloads: () => downloads, contentScript
  };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

function pointer(window, button, type, x = 100, y = 100) {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  button.dispatchEvent(event);
}

test('injection preserves selection, clicking copies the entire answer without downloads', async () => {
  const app = setup();
  try {
    assert.equal(app.window.getSelection().toString(), 'Full');
    app.button.click();
    await tick();
    assert.deepEqual(app.copies, ['Full answer `/agent`']);
    assert.equal(app.downloads(), 0);
    assert.equal(app.window.getSelection().isCollapsed, true);
    assert.match(app.document.querySelector('.gpt-md-toast').textContent, /已复制 Markdown/);
    assert.equal(app.button.hasAttribute('aria-busy'), false);
    app.window.eval(app.contentScript);
    assert.equal(app.document.querySelectorAll('.gpt-md-fab').length, 1);
  } finally { app.window.close(); }
});

test('double clicks do not start overlapping clipboard operations', async () => {
  let finish;
  const app = setup({ clipboard: () => new Promise(resolve => { finish = resolve; }) });
  try {
    app.button.click();
    app.button.click();
    assert.equal(app.copies.length, 1);
    assert.equal(app.button.getAttribute('aria-busy'), 'true');
    finish();
    await tick();
    assert.equal(app.button.hasAttribute('aria-busy'), false);
  } finally { app.window.close(); }
});

test('failed copy restores selection, removes fallback textarea and allows retry', async () => {
  const app = setup({ clipboard: () => Promise.reject(new Error('Denied')) });
  try {
    app.document.execCommand = () => { throw new Error('Failed'); };
    app.button.click();
    await tick();
    assert.equal(app.window.getSelection().toString(), 'Full');
    assert.equal(app.document.querySelector('textarea'), null);
    assert.match(app.document.querySelector('.gpt-md-toast').textContent, /剪贴板写入失败/);
    assert.equal(app.downloads(), 0);
    app.document.execCommand = command => command === 'copy';
    app.button.click();
    await tick();
    assert.equal(app.window.getSelection().isCollapsed, true);
    assert.equal(app.document.querySelector('textarea'), null);
  } finally { app.window.close(); }
});

test('pointerdown preserves target even if selection collapses before click', async () => {
  const app = setup();
  try {
    pointer(app.window, app.button, 'pointerdown');
    app.window.getSelection().removeAllRanges();
    pointer(app.window, app.button, 'pointerup');
    app.button.dispatchEvent(new app.window.MouseEvent('click', { detail: 1 }));
    await tick();
    assert.deepEqual(app.copies, ['Full answer `/agent`']);
  } finally { app.window.close(); }
});

test('dragging clamps all viewport edges and does not copy even if storage fails', async () => {
  const app = setup({ storageBlocked: true });
  try {
    pointer(app.window, app.button, 'pointerdown');
    pointer(app.window, app.button, 'pointermove', -10000, -10000);
    assert.equal(app.button.style.right, `${app.window.innerWidth - 62}px`);
    assert.equal(app.button.style.bottom, `${app.window.innerHeight - 62}px`);
    pointer(app.window, app.button, 'pointermove', 10000, 10000);
    assert.equal(app.button.style.right, '6px');
    assert.equal(app.button.style.bottom, '6px');
    pointer(app.window, app.button, 'pointerup');
    app.button.dispatchEvent(new app.window.MouseEvent('click', { detail: 1 }));
    await tick();
    assert.equal(app.copies.length, 0);
    assert.equal(app.button.captured, false);
  } finally { app.window.close(); }
});

test('pointer cancellation does not leave the button stuck in a drag', async () => {
  const app = setup();
  try {
    pointer(app.window, app.button, 'pointerdown');
    pointer(app.window, app.button, 'pointercancel');
    app.button.dispatchEvent(new app.window.MouseEvent('click', { detail: 1 }));
    await tick();
    assert.equal(app.copies.length, 0);
    app.button.click();
    await tick();
    assert.equal(app.copies.length, 1);
  } finally { app.window.close(); }
});

test('optional download still works when enabled', async () => {
  const app = setup({ download: true });
  try {
    app.window.HTMLAnchorElement.prototype.click = () => {};
    app.button.click();
    await tick();
    assert.equal(app.copies.length, 1);
    assert.equal(app.downloads(), 1);
  } finally { app.window.close(); }
});
