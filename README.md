<div align="center">
  <img src="./images/md_icon.png" alt="" width="128">
  <h1>ChatGPT Answer → Markdown</h1>
  <blockquote>ChatGPT输出结果转换Markdown格式（支持数学符号）</blockquote>
</div>

一个极简的 Chrome 扩展：完美支持数学公式或符号的输出。
在 ChatGPT 页面右下角注入一个**圆形悬浮按钮（FAB）**，允许你**选中任意一条回答**并一键导出为 **Markdown**（自动复制到剪贴板并可选择下载 `.md` 文件）。
> A minimalist Chrome extension that perfectly supports the output of mathematical formulas and symbols.
It injects a **floating circular button (FAB)** in the bottom-right corner of the ChatGPT page, allowing you to **select any response** and **export it to Markdown** with one click — automatically copying it to your clipboard and optionally downloading it as a `.md` file.



- ✅ 深色主题友好（风格与 OpenAI 深色主题接近，但略深以保证对比度）  
- ✅ 悬停自动展开显示文案，默认以圆形“MD”图标占位  
- ✅ 支持**拖拽移动**并**记忆位置**（刷新后仍在你拖拽的位置）  
- ✅ 所有提示采用 **Toast**，**2 秒自动消失**，不打断操作  
- ✅ 只保留一个主功能：**选中回答 → Markdown**

---

## 预览
下载文件效果如下：
![ChatGPT Answer → Markdown 插件演示](./images/demo.gif)

在Obsidian中粘贴效果图下：
![ChatGPT Answer → Markdown 插件演示](./images/demo1.gif)

---

## 安装（开发者模式）

1. 下载本仓库源码（或下方 Release 的 zip 包）并解压。  
2. 打开 Chrome，访问 `chrome://extensions/`。  
3. 右上角开启 **开发者模式**。  
4. 点击 **“加载已解压的扩展程序”**，选择本项目文件夹。  
5. 打开 `https://chatgpt.com/` 或 `https://chat.openai.com/`，页面右下角会出现圆形按钮 **“MD”**。

> 若你更喜欢**独立应用窗口**（PWA/以窗口打开），也同样支持注入按钮。

---

## 使用方法

1. 在 ChatGPT 的**目标回答**内，用鼠标**随便划一下选区**（例如选一段文字）。  
2. 点击右下角的 **MD** 按钮（悬停会展开显示“选中回答 → Markdown”）。  
3. 扩展会：
   - 将该条回答内容**转为 Markdown**（支持代码块、表格、KaTeX 数学）；
   - **复制**到剪贴板；
   - 并**下载**一个 `xxx-selected-answer.md` 文件（如想只复制，可以在代码中注释下载逻辑）。  
4. 页面右下角会显示一个 **Toast**，2 秒后自动消失。

> 如果没有事先选中回答内部的文本，按钮会提示你**先框选**，提示同样以 2 秒自动消失的 Toast 展示。

---

## 发电

如果您觉得有用的话，欢迎来**捐赠**，请`阿洛`喝杯饮料！大家的支持就是我继续开源的动力哟~！

WeChat & Alipay：
<img src="./images/pay_tool.png" alt="" width="800px">

---

## 自定义

你可以在 `content.js` 顶部修改这些行为：

- **是否下载 .md**：在 `handleSelectedAnswerToMarkdown()` 中注释 `downloadText(...)`。  
- **提示时间**：`toast(message, type, duration)` 的 `duration`（毫秒）。  
- **按钮尺寸/展开宽度**：样式中 `.gpt-fab` 的 `height/width` 和 `:hover { width: ... }`。  
- **颜色主题**：修改 `theme` 对象（已根据系统/页面深色主题自动选择深浅版）。

---

## 权限说明

- `clipboardWrite`：用于把导出的 Markdown 写入剪贴板。  
- `scripting`：标准 MV3 权限（由 content script 注入 UI 并在目标域运行）。  
- `host_permissions`：仅匹配 `chatgpt.com` 与 `chat.openai.com` 两个域名。

本扩展**不会**收集、上报、存储你的任何数据。所有处理均在本地页面完成。

---

## 目录结构

```
chatgpt-md-fab/
├─ manifest.json        # MV3 配置
├─ content.js           # 主要逻辑（注入 FAB、选中回答 → Markdown、Toast）
└─ README.md
```

---

## 开发与调试

- 修改代码后，回到 `chrome://extensions/` 点击对应扩展卡片的 **“重新加载”**。  
- 建议在 ChatGPT 页面按 `F12` 打开 DevTools，随时查看 `console` 输出。

---

## 常见问题（FAQ）

**Q: 按钮点了没有反应？**  
A: 先确保你**在目标回答内有选区**（任意选择几个字），然后再点击按钮。若仍无效，查看控制台是否有报错。

**Q: 为什么导出的 Markdown 没有我以为的某些元素？**  
A: 扩展会清理按钮、表单、svg 等“噪音元素”。若你有特殊需求，可在 `htmlToMd()` 的清理选择器中调整。

**Q: 能导出整页对话吗？**  
A: 当前版本专注“单条回答”。若需要整页对话导出，可在 Issues 中告诉我，我会考虑加入可选菜单。

---

## 版本历史

- **1.1.2**  
  - 新增：Toast 提示（2 秒自动消失）；  
  - 新增：拖拽后抑制点击，避免误触提示；  
  - 保持：深色主题、美化圆形按钮、悬停展开、可拖拽/记忆位置。

---

## 许可协议

推荐：MIT License（如需改为其他协议，可自行替换）。
