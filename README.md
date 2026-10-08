# Lambda 线路实验室

输入 Lambda 表达式，转换成 John Tromp 图示，再逐步运行 β 归约。包含快捷符号栏、5 个入门挑战、Church 数与布尔值示例。

## 直接玩

双击 `dist/lambda-lab.html`，无需安装、联网或启动服务器。

1. 在输入框写表达式，或选一个示例。
2. 用快捷栏插入 λ、变量、括号，点击「转换成图示」。
3. 点击「单步」或「运行」，用「回退」查看上一帧。
4. 在闯关模式中运行到正规形，点击「验证答案」。

## 输入语法

- `λx.x` 或 `\x.x`：恒等函数。
- `λx y.x`：`λx.λy.x` 的简写。
- `f x y`：`(f x) y`，应用左结合。
- `f (λx.x)`：作为参数的函数需要括号。
- `xy` 是一个变量名；`x y` 表示应用。
- 变量名以英文字母开头，可含数字、下划线或单引号。
- Ctrl / Command + Enter 转换。

归约采用左最外的正常序，包含 λ 内部。替换自动避免变量捕获。Tromp 图示采用标准横竖连线；自由变量使用带名字的虚线扩展。参见 [John Tromp 原始定义](https://tromp.github.io/cl/diagrams.html)。

输入限 1500 字符，结构限 300 层、4000 节点；展开后的变量名文本限 30000 字符。每轮限 200 步，重复状态会自动暂停。该提示不是一般性的停机判定。

草稿和通关进度保存在本地浏览器中；无法使用存储时仍可以运行。离线文件与 HTTP 预览的存储空间可能不同。

## 开发

Node.js 20 或更高，应用与单元测试均不依赖第三方包。

```text
node --test tests/*.test.cjs
node scripts/build.mjs
node scripts/serve.cjs
```

开发预览默认 `http://127.0.0.1:4189/`，可通过 `PORT` 环境变量改端口。源码在 `src/`，过程文档在 `doc/`。

真实浏览器验收：安装 Playwright 与 Chromium 后运行 `node tests/browser.cjs`。Codex 的捆绑 Node 环境会自动使用捆绑的 Playwright。测试采用临时端口，截图输出到 `tests/artifacts/`。
