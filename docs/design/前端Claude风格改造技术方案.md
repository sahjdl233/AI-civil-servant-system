# 前端改造技术方案：仿 Claude UI · 更贴合人类使用习惯 · 电脑/手机双端适配

版本: V1.0
日期: 2026-08-09
适用范围: `frontend/`（Next.js 15 + React 19 + TypeScript + Tailwind CSS v4）
关联需求: 「整体风格仿照 claude 的 ui，修改整个页面使其更适配人类的使用习惯，并适配电脑端和手机端。」

---

## 1. 背景与目标

### 1.1 现状分析

当前前端为纯展示层改造（不涉及后端 API），涉及文件：

| 文件 | 现状风格问题 |
| --- | --- |
| `frontend/src/app/layout.tsx` | 未引入字体、无全局主题 |
| `frontend/src/app/globals.css` | 冷色系变量（`#ffffff`/`#171717`），默认 Arial 字体 |
| `frontend/src/components/Navigation.tsx` | 顶部横向导航 + 汉堡菜单，emoji 图标 |
| `frontend/src/app/page.tsx` | 大量蓝紫渐变 Hero、彩色卡片、emoji 图标，营销感强 |
| `frontend/src/app/essay/page.tsx` | 蓝紫渐变进度条、彩色手风琴、冷灰表格 |
| `frontend/src/app/assessment/page.tsx` | 多彩色块 + RadarChart 冷色调 |
| `frontend/src/app/practice/page.tsx` | 彩色题型卡片 |
| `frontend/src/app/history/page.tsx` | 冷灰列表 + 详情 |
| `frontend/src/app/profile/page.tsx` | 冷灰统计卡 |
| `frontend/src/app/practice/session/page.tsx` | 练习会话页 |
| `frontend/src/components/RadarChart.tsx` | 雷达图配色 |

**核心问题**：配色偏冷、渐变和 emoji 滥用、顶部导航在手机上信息密度高、缺乏统一的设计令牌（Design Token），各页样式各自为政。

### 1.2 改造目标

1. **视觉风格对齐 Claude.ai**：暖色奶油底色、陶土色（terracotta）点缀、衬线标题 + 无衬线正文、扁平化、克制留白。
2. **更贴合人类使用习惯**：
   - 减少视觉噪音（去掉大面积渐变、emoji 装饰）。
   - 语义化导航（桌面侧边栏 + 移动端底部 Tab 栏）。
   - 关键操作按钮固定可触达（手机端提交按钮吸底）。
   - 阅读体验优化：正文排版采用衬线正文 + 行高 1.7~1.9。
3. **电脑/手机双端适配**：响应式断点全覆盖（桌面/平板/手机），触控目标 ≥ 44px，表格在小屏转卡片。

### 1.3 改造边界

- **纯展示层改造**，业务逻辑（SSE 流式批改、localStorage 记录、API 调用、`dangerouslySetInnerHTML` 内容渲染）**一律不动**。
- 不改动后端接口与 `frontend/src/config/api.ts`、`next.config.ts` 的 `/api` 代理。

---

## 2. 设计令牌（Design Token）

在 `frontend/src/app/globals.css` 中建立统一主题变量（参考 Claude 暖色调），Tailwind v4 通过 `@theme` 映射为工具类。

### 2.1 色板

```css
:root {
  /* 背景与表面 */
  --color-canvas: #faf9f5;        /* 页面主背景：奶油白 */
  --color-surface: #ffffff;       /* 卡片表面 */
  --color-surface-muted: #f0eeea; /* 次级表面 / hover */
  --color-border: #e6e4dc;        /* 细边框：暖灰 */

  /* 文字 */
  --color-ink: #29261c;           /* 主文字：深墨色 */
  --color-ink-secondary: #6b675c; /* 次级文字 */
  --color-ink-tertiary: #9a968c;  /* 弱化文字 / 占位 */

  /* 品牌主色：Claude 陶土色 */
  --color-accent: #d97757;        /* 主操作 / 高亮 */
  --color-accent-hover: #c86a4b;
  --color-accent-soft: #f7e8e0;   /* 主色浅底 */

  /* 功能色（低饱和，避免炫彩） */
  --color-success: #2e7d5b;
  --color-warning: #b07d2b;
  --color-danger: #b3462e;
}
```

### 2.2 字体

- 标题/数字展示：**衬线**，中文用 `Noto Serif SC`（思源宋体），西文用 `Georgia`/`serif` 兜底。
- 正文/界面：**无衬线**，`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`。
- 在 `layout.tsx` 中通过 `next/font/google` 引入 `Noto_Serif_SC`（或本地字体），定义 `--font-serif` 变量。

### 2.3 圆角 / 阴影 / 间距

- 圆角：卡片 `0.75rem`，按钮/输入 `0.5rem`，胶囊 `9999px`。
- 阴影：默认无阴影（扁平化），仅悬浮时 `0 1px 2px rgba(41,38,28,.06)` 极轻阴影。
- 间距基准：`4px` 网格；页面内容最大宽度 `max-w-3xl`（48rem）居中，符合 Claude 的单栏阅读体验。

### 2.4 暗色模式（可选，低成本）

沿用现有 `@media (prefers-color-scheme: dark)` 机制，仅翻转上表变量即可，作为 V1.1 增强项。

---

## 3. 全局布局与导航改造

### 3.1 桌面端：可折叠侧边栏（替代顶部导航）

重写 `frontend/src/components/Navigation.tsx`：

- **桌面（≥1024px）**：左侧固定侧边栏（宽度 248px，可折叠至 56px 图标态），顶栏含品牌区。
  - 导航项：首页 / 申论批改 / 能力测评 / 题库练习 / 学习档案 / 批改历史。
  - 使用 Lucide 风格线性 SVG 图标（不再用 emoji）。
  - 当前页高亮：`surface-muted` 底色 + 左侧 2px 陶土色指示条。
- **移动端（<768px）**：底部固定 Tab 栏（5 个主入口），主 Tab 栏切换，其余入口收入「更多/抽屉」；顶部保留细条品牌栏。
- **平板（768~1023px）**：侧边栏折叠为图标态。

### 3.2 内容区

- 各页主容器统一为 `max-w-3xl mx-auto px-4 sm:px-6 lg:px-8`，配 `min-h-screen bg-canvas text-ink`。
- 页头统一组件 `PageHeader`：衬线大标题 + 次级说明，去渐变背景。

---

## 4. 共享组件

新建 `frontend/src/components/ui/` 目录：

| 组件 | 职责 |
| --- | --- |
| `Button.tsx` | `variant="primary|secondary|ghost"`；primary 为陶土色实心，secondary 为描边/浅底，ghost 纯文字 |
| `Card.tsx` | 统一卡片：`bg-surface border border-border rounded-xl`，无阴影 |
| `Disclosure.tsx` | 折叠区（现 essay 页手风琴逻辑抽取复用，含展开动画） |
| `ScoreBar.tsx` | 进度条：陶土色填充、圆角、平滑过渡 |
| `Badge.tsx` | 弱化小标签（`bg-surface-muted text-ink-secondary`） |
| `icons.tsx` | 内联 SVG 图标集（Lucide 风格 stroke 图标），替换全局 emoji |

> 组件均为受控、无副作用，业务状态仍留在各页面组件内，降低回归风险。

---

## 5. 页面级改造明细

### 5.1 首页 `src/app/page.tsx`

- 移除蓝紫渐变 Hero、彩色渐变功能卡片、emoji。
- 新结构：
  1. **Hero**：居中，衬线大标题「AI 公考智能学习平台」+ 一行说明 + 两个按钮（陶土色主 CTA + 描边次 CTA）。
  2. **数据区**：两个无底色统计卡（题目数/题型数），衬线大数字。
  3. **功能列表**：改为 Claude 风格的编号列表（1. 申论批改 2. 能力测评 …），每项一行标题 + 一行描述 + 右箭头，细分隔线，去掉卡片堆叠。
  4. **学习流程**：四步流程改为简单横向步骤条（`md:grid-cols-4`，小屏单列）。
  5. **页脚**：精简为品牌名 + 一行版权，深色可改暖灰。

### 5.2 申论批改 `src/app/essay/page.tsx`（核心页）

- 去渐变：标题区、进度条、按钮统一陶土色；骨架屏由彩色改浅灰。
- 桌面保持「左输入右结果」分栏（`xl:grid-cols-[2fr_3fr]`），但统一卡片样式。
- 结果区：
  - **综合评分**：衬线大号数字 + 陶土色 `ScoreBar`。
  - **评分细则**：表格保留（信息密集适合表格），但表头改 `surface-muted`、得分颜色用低饱和功能色；手机端表格转为堆叠卡片（见 §6）。
  - **详细反馈 / 改进建议**：`Disclosure` 折叠 + 正文以衬线渲染（仅外层容器加 `font-serif`，内部 `ai-feedback-content` 结构不动）。
- **不修改**：`handleSubmitStream`、SSE 解析、`normalizeDetails`、`sanitizeText`、localStorage 保存等逻辑。

### 5.3 能力测评 `src/app/assessment/page.tsx` + `stats.tsx`

- 统计卡、维度卡改为无渐变暖色风格。
- 维度颜色映射从高饱和六色改为「陶土主色 + 低饱和辅助色」或单色系明度区分。
- `RadarChart.tsx`：描边/填充色替换为陶土色系。

### 5.4 题库练习 `src/app/practice/page.tsx` + `practice/session/page.tsx`

- 题型卡片去掉渐变，保留图标，底色 `surface-muted` hover 上浮。
- 分类练习入口改为列表行样式。
- 会话页：问答区仿 Claude 消息流（题干为浅底卡片、答题输入为白卡、批改结果以 `ai-feedback-content` 呈现）。

### 5.5 历史记录 `src/app/history/page.tsx`

- 主列表：暖色卡片行 + 状态徽标（类型/得分），搜索与筛选控件统一 Input/Select 样式。
- 详情：`master-detail` 布局，手机端详情为全屏抽屉（`fixed inset-0 overflow-auto`）。
- `sanitizeText` 逻辑不动。

### 5.6 学习档案 `src/app/profile/page.tsx`

- 统计卡、维度进度统一 `Card` + `ScoreBar`，删除彩色渐变。
- localStorage 读取逻辑不动。

---

## 6. 响应式方案（电脑/手机适配）

| 断点 | 布局策略 |
| --- | --- |
| ≥1024px 桌面 | 侧边栏展开（248px）+ 内容单栏居中 `max-w-3xl`；essay 页左右分栏 |
| 768–1023px 平板 | 侧边栏图标态（56px） |
| <768px 手机 | 底部 Tab 栏 + 顶部细品牌栏；所有多栏变单列；essay 页输入与结果上下堆叠，结果区「提交后自动滚动到结果」 |

手机端专项：

- 触控目标：按钮/链接最小 `h-11`（44px）。
- **吸底提交按钮**：essay 页提交按钮在输入区可见时吸底（`fixed bottom-16 left-0 right-0` 白底内边距），避免长页面滑到顶才看到按钮。
- **评分细则表转卡片**：`<768px` 下用 `md:hidden` 渲染卡片版本，`hidden md:block` 保留表格版本（两套 DOM 切换，纯展示无逻辑）。
- 字号自适应：标题 `text-2xl md:text-4xl`，正文基准 `text-[15px]`。

---

## 7. 实施步骤（任务拆分）

| 步骤 | 内容 | 验证 |
| --- | --- | --- |
| 1 | `globals.css` 重建主题变量 + `layout.tsx` 引入字体 | 页面底色/字体生效 |
| 2 | 新建 `ui/` 共享组件（Button/Card/Disclosure/ScoreBar/Badge/icons） | `npm run lint` |
| 3 | 重写 `Navigation.tsx`（侧边栏 + 底部 Tab + 抽屉） | 三端断点手测 |
| 4 | 改造首页 `page.tsx` | 手测 |
| 5 | 改造 essay 页（含吸底按钮、表格转卡片） | 功能回归（SSE 批改仍可用） |
| 6 | 改造 assessment / RadarChart | 手测 |
| 7 | 改造 practice / session | 手测 |
| 8 | 改造 history / profile | 手测 |
| 9 | 全量回归：`npm run lint` + `npm run build` + 双端浏览器验证 | 无 TS/构建错误 |

> 每步保持「先样式后细节」，业务逻辑零改动，便于随时合入。

---

## 8. 回归与验收

### 8.1 功能回归清单（不得回退）

- [ ] 申论批改 SSE 渐进式展示、降级 one-shot 正常
- [ ] `ai-feedback-content` 内容渲染不变（仅外层排版样式调整）
- [ ] 历史记录读取/删除、学习档案 localStorage 记录
- [ ] 测评提交与雷达图
- [ ] `/api/*` 代理（`next.config.ts`）未改动

### 8.2 视觉验收

- 桌面 1440 / 1280：侧边栏 + 居中单栏
- 平板 820：图标侧栏
- 手机 390 / 375：底部 Tab、吸底提交、表格转卡片、无横向滚动
- 无障碍：正文对比度 ≥ 4.5:1，焦点可见（`:focus-visible` 描边）

### 8.3 构建验证

```
cd frontend && npm run lint && npm run build
```

---

## 9. 风险与注意事项

| 风险 | 应对 |
| --- | --- |
| Tailwind v4 `@theme` 语法差异 | 使用 `@theme inline` 映射 CSS 变量，与现有配置一致 |
| `next/font/google` 拉取字体受网络影响 | 配置 `display: 'swap'` + 系统字体 fallback；离线环境改用本地字体文件 |
| essay 页逻辑复杂（863 行） | 只改 JSX 样式类名与新增容器，不改任何 handler；分步提交 |
| 手机端双表格 DOM 切换 | 切换仅发生在 `md` 断点，无 JS 依赖，React 渲染天然安全 |
| 暗色模式变量未定义导致对比度问题 | V1.1 再开放暗色；V1.0 强制浅色（移除 `prefers-color-scheme` 覆盖或定义完整暗色令牌二选一） |

---

## 10. 附：参考视觉基准（Claude 风格要点速查）

- 底色 `#FAF9F5` 类奶油白，边框极细 `#E6E4DC`。
- 主色陶土 `#D97757` 仅用于主 CTA、高亮与进度填充。
- 大标题衬线、正文无衬线、行高 1.7~1.9，段落间距克制。
- 扁平化：边框 > 阴影，阴影仅悬浮轻投影。
- 空态用简单图标 + 一行文案，不铺陈。
- 图标统一线性 SVG（stroke 1.5~2px），不用 emoji 表达功能。
