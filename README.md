# ChatGPT Answer to Markdown (FAB)

> 中文 | [English](#english)

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](./manifest.json)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/xiuluo211314/chatgpt-md-fab?style=social)](https://github.com/xiuluo211314/chatgpt-md-fab/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/xiuluo211314/chatgpt-md-fab?style=social)](https://github.com/xiuluo211314/chatgpt-md-fab/forks)
[![GitHub issues](https://img.shields.io/github/issues/xiuluo211314/chatgpt-md-fab)](https://github.com/xiuluo211314/chatgpt-md-fab/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/xiuluo211314/chatgpt-md-fab)](https://github.com/xiuluo211314/chatgpt-md-fab/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/xiuluo211314/chatgpt-md-fab?include_prereleases)](https://github.com/xiuluo211314/chatgpt-md-fab/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/xiuluo211314/chatgpt-md-fab/total)](https://github.com/xiuluo211314/chatgpt-md-fab/releases)

一个 Chrome MV3 扩展：在 ChatGPT 页面右下角注入一个可拖动的 `MD` 悬浮按钮。你只需要在目标助手回答里选中任意一小段文字，点击按钮，就可以把整条回答复制并下载为干净的 Markdown。

![Demo](./images/demo.gif)

## 目录

- [功能](#功能)
- [本次修复重点](#本次修复重点)
- [安装](#安装)
- [使用](#使用)
- [GitHub 统计与展示](#github-统计与展示)
- [转换规则](#转换规则)
- [开发与调试](#开发与调试)
- [权限说明](#权限说明)
- [项目结构](#项目结构)
- [版本历史](#版本历史)
- [English](#english)

## 功能

- 选中任意助手回答后，一键导出整条回答，而不是只导出选中的片段。
- 自动复制到剪贴板，并下载 `*-selected-answer.md` 文件。
- 保留常见 Markdown 结构：标题、段落、加粗、斜体、行内代码、代码块、引用、列表、分割线、表格、图片、链接。
- 支持 ChatGPT 当前 CodeMirror 风格代码块 DOM，避免把复制按钮、代码块标题栏等 UI 噪声写入 Markdown。
- 支持 KaTeX 公式：块级公式导出为 `$$...$$`，行内公式导出为 `$...$`。
- 悬浮按钮支持拖动，并记忆位置。
- 所有转换都在当前浏览器页面本地完成，不上传、不存储对话内容。

## 本次修复重点

旧版本的主要问题在 `content.js` 的 HTML 到 Markdown 转换逻辑：

- 行内代码曾被导出成 `%60/agent%60`，现在修复为标准 Markdown 反引号：`` `/agent` ``。
- ChatGPT 新版代码块 DOM 中嵌套了 CodeMirror 容器，旧逻辑容易把 UI 元素和代码文本混在一起。现在会先抽取真实代码文本，再生成 fenced code block。
- `<br>` 在代码块中不一定会被 `textContent` 转成换行，导致多行代码被挤成一行。现在转换时会显式保留 `<br>` 换行。
- 表格单元格中的 `|` 和换行现在会做 Markdown 安全处理。
- 旧 README 和 manifest 中存在编码乱码，已恢复为可读内容。

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目文件夹。
5. 打开或刷新 `https://chatgpt.com/`。

## 使用

1. 在 ChatGPT 的目标助手回答中，用鼠标选中任意几个字。
2. 点击页面右下角的 `MD` 按钮。
3. 扩展会把整条助手回答转换为 Markdown，复制到剪贴板，并下载一个 `.md` 文件。

如果没有选中助手回答中的文字，按钮会用 Toast 提示你先选中目标回答。

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

修改代码后，在 `chrome://extensions/` 中点击扩展卡片的“重新加载”，然后刷新 ChatGPT 页面。

建议用下面几类内容测试导出结果：

- 包含 `/agent`、`.bib`、`services/` 等行内代码的段落。
- 多行代码块和带语言标识的代码块。
- 有序列表、无序列表、嵌套列表。
- 表格、链接、引用、数学公式。

语法检查：

```powershell
node --check content.js
```

manifest 检查：

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## 权限说明

- `clipboardWrite`：用于把导出的 Markdown 写入剪贴板。
- `host_permissions`：仅匹配 `chatgpt.com` 和 `chat.openai.com`。

扩展不收集、不上传、不存储你的对话数据。所有转换都在当前浏览器页面本地完成。

## 项目结构

```text
chatgpt-md-fab/
├── manifest.json
├── content.js
├── README.md
├── LICENSE
└── images/
    ├── demo.gif
    ├── demo1.gif
    ├── md_icon.png
    └── pay_tool.png
```

## 版本历史

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

ChatGPT Answer to Markdown (FAB) is a Chrome Manifest V3 extension. It injects a draggable `MD` floating action button into ChatGPT pages. Select any text inside a target assistant answer, click the button, and the extension copies and downloads the whole answer as clean Markdown.

## Features

- Export the whole assistant answer after selecting any text inside it.
- Copy Markdown to the clipboard and download a `*-selected-answer.md` file.
- Preserve common Markdown structures: headings, paragraphs, bold, italic, inline code, code blocks, blockquotes, lists, horizontal rules, tables, images, and links.
- Support ChatGPT's current CodeMirror-style code block DOM and avoid copying UI noise such as copy buttons and code block toolbars.
- Support KaTeX formulas: display formulas as `$$...$$` and inline formulas as `$...$`.
- Draggable floating button with position persistence.
- Fully local conversion. No conversation data is uploaded, collected, or stored.

## What Was Fixed

The main issue was in the HTML-to-Markdown conversion logic in `content.js`:

- Inline code used to be exported as `%60/agent%60`; it is now exported as standard Markdown: `` `/agent` ``.
- Newer ChatGPT code blocks use deeply nested CodeMirror DOM. The converter now extracts the real code text before generating fenced code blocks.
- `<br>` inside code blocks is now preserved as a newline.
- Table cells now escape `|` and normalize newlines.
- README and manifest encoding issues were cleaned up.

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this project folder.
5. Open or refresh `https://chatgpt.com/`.

## Usage

1. Select any text inside the target assistant answer.
2. Click the `MD` button in the bottom-right corner.
3. The extension converts the whole assistant answer to Markdown, copies it to the clipboard, and downloads a `.md` file.

If no assistant answer text is selected, the extension shows a Toast reminder.

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

After editing the code, reload the extension in `chrome://extensions/`, then refresh the ChatGPT page.

Recommended test cases:

- Paragraphs containing inline code such as `/agent`, `.bib`, and `services/`.
- Multi-line code blocks and language-tagged code blocks.
- Ordered lists, unordered lists, and nested lists.
- Tables, links, blockquotes, and math formulas.

Syntax check:

```powershell
node --check content.js
```

Manifest check:

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## Permissions

- `clipboardWrite`: writes exported Markdown to the clipboard.
- `host_permissions`: only matches `chatgpt.com` and `chat.openai.com`.

The extension does not collect, upload, or store your conversation data.

## Project Structure

```text
chatgpt-md-fab/
├── manifest.json
├── content.js
├── README.md
├── LICENSE
└── images/
    ├── demo.gif
    ├── demo1.gif
    ├── md_icon.png
    └── pay_tool.png
```

## Changelog

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
