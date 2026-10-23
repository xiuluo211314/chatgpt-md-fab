# ChatGPT Answer to Markdown (FAB)

> 中文 | [English](#english)

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](./manifest.json)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/xiuluo211314/chatgpt-md-fab?style=social)](https://github.com/xiuluo211314/chatgpt-md-fab/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/xiuluo211314/chatgpt-md-fab?style=social)](https://github.com/xiuluo211314/chatgpt-md-fab/forks)
[![GitHub issues](https://img.shields.io/github/issues/xiuluo211314/chatgpt-md-fab)](https://github.com/xiuluo211314/chatgpt-md-fab/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/xiuluo211314/chatgpt-md-fab)](https://github.com/xiuluo211314/chatgpt-md-fab/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/xiuluo211314/chatgpt-md-fab?include_prereleases)](https://github.com/xiuluo211314/chatgpt-md-fab/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/xiuluo211314/chatgpt-md-fab/total)](https://github.com/xiuluo211314/chatgpt-md-fab/releases)

一个 Chrome MV3 扩展：在 ChatGPT 页面右下角注入一个可拖动的 `MD` 悬浮按钮。你只需要在目标助手回答里选中任意一小段文字，点击按钮，就可以把整条回答复制为干净的 Markdown。默认只复制，不自动下载文件。

![Demo](./images/demo.gif)

## 目录

- [功能](#功能)
- [兼容性与性能](#兼容性与性能)
- [安装](#安装)
- [使用](#使用)
- [配置](#配置)
- [GitHub 统计与展示](#github-统计与展示)
- [转换规则](#转换规则)
- [开发与调试](#开发与调试)
- [权限说明](#权限说明)
- [项目结构](#项目结构)
- [版本历史](#版本历史)
- [English](#english)

## 功能

- 选中任意助手回答后，一键导出整条回答，而不是只导出选中的片段。
- 自动复制到剪贴板，默认不下载文件。
- 可通过配置项开启 `*-selected-answer.md` 文件下载。
- 保留常见 Markdown 结构：标题、段落、加粗、斜体、行内代码、代码块、引用、列表、分割线、表格、图片、链接。
- 通过助手角色或 `data-turn="assistant"` 定位回答，拒绝用户消息和跨回答选择；支持同一回答的多个内容片段。
- 支持传统代码块和 CodeMirror 的 `<br>` / `.cm-line` 结构，保留代码空行、缩进和行尾空格。
- 支持 KaTeX 公式：块级公式导出为 `$$...$$`，行内公式导出为 `$...$`。
- 悬浮按钮保持固定尺寸，支持拖动、位置记忆、键盘激活和视口边界限制。
- 复制失败保留选区供重试；连续点击不会重复执行导出。
- 只处理目标回答，不扫描整段会话、不轮询页面；运行时无第三方依赖。
- 所有转换都在当前浏览器页面本地完成，不上传、不存储对话内容。

## 兼容性与性能

1.3.0 保留原有的选中回答后复制流程，并修复以下问题：

- 通过助手角色与 section 定位回答，避免误导出用户消息；跨多条回答选择时提示重新选择。
- 同一回答的多个 Markdown 片段按页面顺序导出，嵌套容器不会重复导出。
- 不再全局压缩代码块的空行；含反引号的代码使用足够长的围栏。
- 保留多位数有序列表、嵌套列表、任务列表、引用和表格对齐。
- 从 KaTeX 的 TeX annotation 提取公式，避免重复导出渲染层；保留引用链接和正文文档按钮的文字。
- 转义正文 Markdown 标记及链接括号，避免粘贴后改变原文含义。
- 注入时不清除选区；点击时保留目标；复制失败清理临时文本框并恢复选区。
- 修复拖动取消、误触发复制及位置越界问题。

转换器直接只读遍历目标回答，移除整棵 DOM 克隆和占位符替换。新增 `markdown.js` 与 UI 逻辑分离，便于测试；无需构建即可加载扩展。

验证范围：自动化测试覆盖合成 DOM 和点击流程；另在用户之前提供的 HTML 样本（3200 个元素）上做了转换与基准验证。当前工具未连接用户的 Chrome，尚未对最新在线 ChatGPT 页面完成端到端验证。ChatGPT 的灰度版本仍可能存在其他 DOM 结构。

性能参考：Node 24 + jsdom 下，同一份历史 HTML 样本预热后各测量 15 次，旧版 1.2.1 的转换中位耗时约 69 ms，新版约 20 ms，减少约 71%。这只测量本地 DOM 转换，不包含剪贴板、布局或网络耗时，不代表 Chrome 实际响应速度。可用下方基准命令测量自己的样本。

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目文件夹。
5. 打开或刷新 `https://chatgpt.com/`。

## 使用

1. 在 ChatGPT 的目标助手回答中，用鼠标选中任意几个字。
2. 点击页面右下角的 `MD` 按钮。
3. 扩展会把整条助手回答转换为 Markdown，并复制到剪贴板。

如果没有选中助手回答中的文字，按钮会用 Toast 提示你先选中目标回答。

只能选择同一条助手回答；选中片段仅用于定位，输出仍是整条回答。无需滚动到回答底部。

更新后，在 `chrome://extensions/` 点击本扩展的“重新加载”，再刷新已打开的 ChatGPT 标签页。仅刷新标签页不会重新加载修改过的扩展文件。

## 配置

默认点击 `MD` 后只复制 Markdown，不下载文件。如果你也希望同时下载 `.md` 文件，可以在 `content.js` 顶部修改配置：

```js
const OPTIONS = {
  downloadAfterCopy: true
};
```

默认配置如下：

```js
const OPTIONS = {
  downloadAfterCopy: false
};
```

## GitHub 统计与展示

当前仓库地址：

```text
xiuluo211314/chatgpt-md-fab
```

当前 README 已预置这些主流 GitHub 展示信息：

| 类型 | 用途 |
| --- | --- |
| Version | 显示当前扩展版本 |
| Manifest V3 | 标明 Chrome MV3 扩展 |
| License | 显示开源协议 |
| Stars | 显示 GitHub Star 数 |
| Forks | 显示 Fork 数 |
| Issues | 显示当前 Issue 数 |
| Last commit | 显示最近提交时间 |
| Release | 显示最新 GitHub Release |
| Downloads | 显示 Release 下载总量 |

你也可以在 README 末尾加入 Star History 图，用于展示项目增长趋势：

[![Star History Chart](https://api.star-history.com/svg?repos=xiuluo211314/chatgpt-md-fab&type=Date)](https://star-history.com/#xiuluo211314/chatgpt-md-fab&Date)

如果后续发布到 Chrome Web Store，还可以追加：

```markdown
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID)](https://chromewebstore.google.com/detail/EXTENSION_ID)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/EXTENSION_ID)](https://chromewebstore.google.com/detail/EXTENSION_ID)
```

## 转换规则

| HTML / ChatGPT DOM | Markdown 输出 |
| --- | --- |
| `h1` - `h6` | `#` - `######` |
| `p` | 普通段落 |
| `strong` / `b` | `**text**` |
| `em` / `i` | `*text*` |
| `code` | `` `code` `` |
| `pre` / CodeMirror code block | fenced code block |
| `blockquote` | `> quote` |
| `ul` / `ol` | `- item` / `1. item` |
| `table` | Markdown table |
| `.katex-display` | `$$...$$` |
| `.katex` | `$...$` |

## 开发与调试

需要 Node.js 18 或以上版本（仅开发测试需要）。安装和使用扩展不需要 Node、npm 或构建步骤。

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run check
npm.cmd run benchmark
# 可选：只读测量本地 HTML 样本，不打印或上传样本内容
node scripts/benchmark.cjs path/to/sample.html
```

修改代码后，在 `chrome://extensions/` 中点击扩展卡片的“重新加载”，然后刷新 ChatGPT 页面。

建议用下面几类内容测试导出结果：

- 包含 `/agent`、`.bib`、`services/` 等行内代码的段落。
- 多行代码块和带语言标识的代码块。
- 有序列表、无序列表、嵌套列表。
- 表格、链接、引用、数学公式。

语法检查：

```powershell
node --check content.js
node --check markdown.js
```

manifest 检查：

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## 权限说明

- `clipboardWrite`：用于把导出的 Markdown 写入剪贴板。
- `host_permissions`：仅匹配 `chatgpt.com` 和 `chat.openai.com`。

扩展不收集、不上传、不存储你的对话数据。所有转换都在当前浏览器页面本地完成。

仅把按钮位置保存在站点本地存储中。导出范围是当前已加载的回答 DOM；折叠内容、虚拟化后未加载的代码、Canvas/交互式图形无法保证完整恢复。图片和附件保留页面提供的链接，不下载资源；临时或需登录的链接可能无法在其他设备使用。

## 项目结构

```text
chatgpt-md-fab/
├── manifest.json
├── content.js       # FAB, clipboard and drag interactions
├── markdown.js      # Answer selection and conversion
├── tests/           # DOM and interaction regression tests
├── scripts/benchmark.cjs
├── package.json     # Development dependencies only
├── package-lock.json
├── README.md
├── LICENSE
└── images/
    ├── demo.gif
    ├── demo1.gif
    ├── md_icon.png
    └── pay_tool.png
```

## 版本历史

### 1.3.0

- 修复回答定位、跨回答选择、多片段导出和点击时选区丢失。
- 保留 CodeMirror 换行及代码空白，改进列表、公式、引用链接和 Markdown 转义。
- 只读遍历目标回答，移除重复 DOM 克隆及占位符替换。
- 修复复制失败重试、连续点击、拖动取消及位置越界等交互问题。
- 新增自动化回归测试与本地性能基准；默认仍然只复制。

### 1.2.1

- 默认点击 `MD` 后只复制 Markdown，不自动下载文件。
- 新增 `OPTIONS.downloadAfterCopy` 配置项，可手动开启 `.md` 文件下载。

### 1.2.0

- 修复行内代码被导出为 `%60...%60` 的问题。
- 优化 ChatGPT 新版代码块 DOM 的提取逻辑。
- 改进列表、表格、引用、公式等 Markdown 转换。
- 增加剪贴板写入兜底逻辑。
- 修复 README 和 manifest 编码乱码。

### 1.1.2

- 增加 Toast 提示。
- 支持拖动悬浮按钮并记忆位置。
- 支持选中回答后导出 Markdown。

## License

MIT License

---

# English

[Back to Chinese](#chatgpt-answer-to-markdown-fab)

ChatGPT Answer to Markdown (FAB) is a Chrome Manifest V3 extension. It injects a draggable `MD` floating action button into ChatGPT pages. Select any text inside a target assistant answer, click the button, and the extension copies the whole answer as clean Markdown. File download is disabled by default.

## Features

- Export the whole assistant answer after selecting any text inside it.
- Copy Markdown to the clipboard. File download is disabled by default.
- Optionally enable `*-selected-answer.md` downloads through configuration.
- Preserve common Markdown structures: headings, paragraphs, bold, italic, inline code, code blocks, blockquotes, lists, horizontal rules, tables, images, and links.
- Support traditional code blocks and CodeMirror `<br>` / `.cm-line` layouts while preserving code whitespace.
- Support KaTeX formulas: display formulas as `$$...$$` and inline formulas as `$...$`.
- Fixed-size draggable button with position persistence, viewport bounds and keyboard activation.
- Reject user messages and selections across answers. Export all content fragments of the chosen answer.
- Prevent overlapping exports; retain selection for retry after copy failure.
- Fully local conversion. No conversation data is uploaded, collected, or stored.

## Compatibility And Performance

Version 1.3.0 retains the select-and-copy workflow and fixes answer detection, selections spanning multiple answers, multi-fragment responses, CodeMirror line breaks, code whitespace, nested lists, task lists, formulas, citation links and Markdown escaping.

The converter walks only the selected answer without cloning its DOM or repeatedly replacing placeholders. `markdown.js` contains selection and conversion logic; `content.js` handles the FAB and clipboard. There are no runtime dependencies or build steps.

Tests cover synthetic DOM structures and click interactions. Conversion was also checked against a previously supplied HTML sample containing 3200 elements. The user's Chrome is not connected to the current tooling, so the latest live ChatGPT UI has not been verified end to end. Other rollout variants may require further adjustments.

On Node 24 + jsdom, after warmup and 15 measurements per version on the same historical sample, median conversion time fell from about 69 ms (1.2.1) to 20 ms (1.3.0), about 71% less. This measures local DOM conversion only, excluding clipboard, layout and network time; it is not a Chrome response-time measurement. Use the benchmark below to measure your own sample.

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this project folder.
5. Open or refresh `https://chatgpt.com/`.

## Usage

1. Select any text inside the target assistant answer.
2. Click the `MD` button in the bottom-right corner.
3. The extension converts the whole assistant answer to Markdown and copies it to the clipboard.

If no assistant answer text is selected, the extension shows a Toast reminder.

Select within one assistant answer only. The selection identifies the answer; the entire answer is exported. After updating, reload the extension in `chrome://extensions/`, then refresh any open ChatGPT tabs.

## Configuration

By default, clicking `MD` only copies Markdown and does not download a file. To also download a `.md` file, change the option near the top of `content.js`:

```js
const OPTIONS = {
  downloadAfterCopy: true
};
```

Default configuration:

```js
const OPTIONS = {
  downloadAfterCopy: false
};
```

## GitHub Badges And Stats

Repository: [xiuluo211314/chatgpt-md-fab](https://github.com/xiuluo211314/chatgpt-md-fab)

This README includes common GitHub project badges:

| Badge | Meaning |
| --- | --- |
| Version | Current extension version |
| Manifest V3 | Chrome extension platform |
| License | Open-source license |
| Stars | GitHub stars |
| Forks | GitHub forks |
| Issues | Open GitHub issues |
| Last commit | Latest commit activity |
| Release | Latest GitHub release |
| Downloads | Total release downloads |

Optional Star History chart:

[![Star History Chart](https://api.star-history.com/svg?repos=xiuluo211314/chatgpt-md-fab&type=Date)](https://star-history.com/#xiuluo211314/chatgpt-md-fab&Date)

Optional Chrome Web Store badges:

```markdown
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID)](https://chromewebstore.google.com/detail/EXTENSION_ID)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/EXTENSION_ID)](https://chromewebstore.google.com/detail/EXTENSION_ID)
```

## Conversion Rules

| HTML / ChatGPT DOM | Markdown Output |
| --- | --- |
| `h1` - `h6` | `#` - `######` |
| `p` | Paragraph |
| `strong` / `b` | `**text**` |
| `em` / `i` | `*text*` |
| `code` | `` `code` `` |
| `pre` / CodeMirror code block | fenced code block |
| `blockquote` | `> quote` |
| `ul` / `ol` | `- item` / `1. item` |
| `table` | Markdown table |
| `.katex-display` | `$$...$$` |
| `.katex` | `$...$` |

## Development

Node.js 18+ is needed only for development. Installing and using the extension requires no npm commands or build step.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run check
npm.cmd run benchmark
# Optional: reads a local sample without printing or uploading its content
node scripts/benchmark.cjs path/to/sample.html
```

After editing the code, reload the extension in `chrome://extensions/`, then refresh the ChatGPT page.

Recommended test cases:

- Paragraphs containing inline code such as `/agent`, `.bib`, and `services/`.
- Multi-line code blocks and language-tagged code blocks.
- Ordered lists, unordered lists, and nested lists.
- Tables, links, blockquotes, and math formulas.

Syntax check:

```powershell
node --check content.js
node --check markdown.js
```

Manifest check:

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## Permissions

- `clipboardWrite`: writes exported Markdown to the clipboard.
- `host_permissions`: only matches `chatgpt.com` and `chat.openai.com`.

The extension does not collect, upload, or store your conversation data.

Only the button position is stored locally. Only currently loaded answer DOM can be exported. Collapsed content, virtualized code and Canvas/interactive graphics may be incomplete. Images and attachments retain the URLs supplied by the page; resources are not downloaded, and temporary or authenticated links may not work on other devices.

## Project Structure

```text
chatgpt-md-fab/
├── manifest.json
├── content.js       # FAB, clipboard and drag interactions
├── markdown.js      # Answer selection and conversion
├── tests/           # DOM and interaction regression tests
├── scripts/benchmark.cjs
├── package.json     # Development dependencies only
├── package-lock.json
├── README.md
├── LICENSE
└── images/
    ├── demo.gif
    ├── demo1.gif
    ├── md_icon.png
    └── pay_tool.png
```

## Changelog

### 1.3.0

- Fixed answer selection, multi-fragment export and selection loss on click.
- Preserved CodeMirror lines and code whitespace; improved lists, formulas, citations and escaping.
- Replaced repeated DOM cloning and placeholder replacement with read-only traversal.
- Fixed clipboard retry, overlapping clicks, cancelled drags and off-screen positioning.
- Added regression tests and a local benchmark. Copy-only remains the default.

### 1.2.1

- Changed the default action to copy Markdown only.
- Added `OPTIONS.downloadAfterCopy` for optional `.md` file downloads.

### 1.2.0

- Fixed inline code exported as `%60...%60`.
- Improved extraction for newer ChatGPT code block DOM.
- Improved Markdown conversion for lists, tables, blockquotes, and formulas.
- Added clipboard fallback.
- Fixed README and manifest encoding issues.

### 1.1.2

- Added Toast notifications.
- Added draggable floating button with persisted position.
- Supported Markdown export for selected assistant answers.

## License

MIT License
