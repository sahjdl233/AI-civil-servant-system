# 智考公考伴侣 - AI驱动的申论批改平台

一个基于AI的公务员考试申论批改平台，提供智能评分、详细反馈和个性化改进建议。

## ✨ 核心功能

- **AI申论批改**: 双阶段智能评分，支持概括题、综合分析题、对策题、应用文写作题
- **题型自动识别**: 增强版AI题型识别，支持推理模型，准确率显著提升
- **专业诊断**: 基于《申论四大题型核心秘籍》的专业批改，内容纯净无prompt泄漏
- **详细反馈**: 评分细则、具体建议和改写示例，智能过滤通用建议
- **实时进度**: 渐进式评分显示，50%诊断 + 100%完整评价
- **用户友好**: 自动清理AI内部指令，确保界面内容专业简洁
- **Prompt 库**: 后台在线编辑所有批改 Prompt，版本管理与发布即生效，无需改代码

## 🚀 快速开始

### 一键启动开发环境

在项目根目录运行以下命令：

```powershell
# 推荐：动态端口分配（自动处理端口占用）
.\scripts\dev-fullstack.ps1

# 固定端口开发（稀有端口，避免冲突）
.\scripts\run-dev-rare-ports.ps1

# 自定义端口
D:\some\run-dev-rare-ports.ps1 -BackendPort 8004 -FrontendPort 3000
```

### 访问地址

启动后控制台会显示实际访问地址，通常为：
- **前端**: http://localhost:3000 (或动态分配端口)
- **后端API**: http://localhost:8001 (或动态分配端口)
- **API文档**: http://localhost:8001/docs

### 停止开发环境

```powershell
# 在启动窗口按 Ctrl+C 停止服务
# 或使用快速管理工具
.\scripts\quick-restart.bat stop
```

## 🏗️ 技术架构

### 前端
- **Next.js 15** + React 19 + TypeScript
- **Tailwind CSS v4** 现代化UI设计
- **Turbopack** 快速开发体验
- **动态端口管理** 自动检测和配置

### 后端  
- **FastAPI** + Python 3.10+
- **PostgreSQL** + SQLAlchemy + Alembic
- **OpenAI API** 双阶段智能批改，支持推理模型
- **申论四大题型核心秘籍** 专业评分标准
- **智能内容过滤** 自动清理prompt指令，确保用户界面纯净
- **增强题型识别** 改进的启发式算法，支持多种AI模型响应格式

### 开发环境
- **Docker** 容器化数据库
- **热重载** 前后端自动更新
- **智能端口管理** 自动处理端口占用
- **端口复用** 智能检测和复用已运行实例

## 🧩 Prompt 库使用指南

平台内置 **Prompt 库**：所有批改 Prompt（题型识别、诊断、阅卷、Coach、标准答案、Consensus 等）都可以在后台在线编辑与版本管理，**修改后无需改代码发版，发布即生效**。

### 入口

打开前端 **设置** 页（`/admin/providers`），切换到「Prompt 库」标签：

- 左侧按分类列出模板（题型识别 / 题型诊断 / 整体评价 / 阅卷官 / Coach / 标准答案 / Consensus / 知识库）
- 右侧是编辑器 + 版本历史
- 支持：编辑内容、预览渲染、保存草稿、保存并发布、版本对比、发布旧版本回滚、新增模板、删除模板、重置为内置默认

### 模板内容怎么写

模板正文即最终发给 AI 的 prompt 文本。用 `{{变量名}}` 双花括号作为占位符，会被替换成实际批改输入；**JSON 示例用单花括号 `{ }` 直接写，渲染时原样保留**。

示例：

```
你是资深申论阅卷官，有20年阅卷经验。

=== 输入 ===
【题目材料与题干】
{{question}}

【学生作答】
{{answer}}

【题型】{{question_type}}

=== 输出格式 ===
只输出一个 JSON，禁止任何多余文字：
{
  "total_score": 72,
  "score_breakdown": [
    {"item": "内容要点", "full_score": 40, "actual_score": 28}
  ]
}
```

### 可用占位符

| 变量 | 用途 | 适用模板 |
| --- | --- | --- |
| `{{question_type}}` | 题型名称 | 全部 |
| `{{question}}` | 题目材料与题干 | grader / coach / standard_answer / qtype_detection |
| `{{answer}}` | 学生作答 | grader / coach |
| `{{essay_content}}` | 学生作答（别名） | 诊断类 / evaluation |
| `{{dimensions}}` | 按题型生成的维度 JSON（代码生成，留空占位即可） | 诊断类 |
| `{{methodology_description}}` | 四步法方法论描述（代码生成，留空占位即可） | 诊断类 |
| `{{diagnosis_result}}` | 第一阶段诊断结果 JSON | evaluation |
| `{{model_results}}` | 多模型评分结果数组 JSON | consensus |
| `{{aggregate}}` | 多模型统计汇总 JSON | consensus |
| `{{knowledge_base}}` | 知识库全文 | 阅卷链路 |

### 注意事项

- **渲染是正则替换**（非 `str.format`），所以模板里的 JSON 大括号无需转义；双花括号 `{{变量}}` 是唯一被替换的语法。
- 缺失的变量渲染为空串并记录告警；未知变量名保留原文不替换。
- 诊断类模板的 `{{dimensions}}` / `{{methodology_description}}` 由代码按题型自动生成，模板里留占位符即可，不要手写具体维度。
- 模板按 **库优先、内置兜底** 运行：已发布且启用的版本优先；未发布 / 停用 / 不存在时回退到内置默认 prompt，保证批改链路永不中断。
- 发布任意历史版本即回滚，版本不可变，审计轨迹完整。

## 📁 项目结构

```
├── scripts/                # 脚本集中目录
│   ├── dev-fullstack.ps1       # 动态端口全栈启动脚本
│   ├── run-dev-rare-ports.ps1  # 固定端口启动脚本（稀有端口，也可使用 .\scripts\run-dev-rare-ports.ps1）
│   └── quick-restart.bat       # 快速服务管理工具
│   ├── app/               # 应用源码
│   │   ├── api/endpoints/ # API路由
│   │   ├── services/      # AI服务集成
│   │   ├── schemas/       # 数据模型
│   │   └── models/        # 数据库模型
│   ├── alembic/           # 数据库迁移
│   └── dev.ps1            # 后端开发脚本
├── frontend/              # Next.js前端
│   ├── src/app/           # 页面组件
│   ├── src/config/        # API配置
│   ├── start-server.js    # 自定义服务器启动器
│   └── package.json       # 依赖配置
├── tools/                 # 工具脚本
│   ├── safe_cleanup.py    # 安全清理工具
│   └── restore_from_trash.py # 文件恢复工具
└── 申论四大题型核心秘籍.md  # 专业评分标准文档
```

## 🔧 开发指南

### 环境要求
- Python 3.10+
- Node.js 18+
- Docker (可选，用于数据库)

### 配置说明
1. 在 `backend` 目录创建 `.env` 文件：
```env
OPENAI_API_KEY=你的OpenAI密钥
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4o-mini
```

2. 启动开发环境：
```powershell
# 动态端口（推荐）
.\dev-fullstack.ps1

# 固定端口（避免冲突）
D:\some\run-dev-rare-ports.ps1
```

### API 接口
- `POST /api/v1/essays/grade` - 传统评分接口
- `POST /api/v1/essays/grade-progressive` - 渐进式评分接口
- `GET /api/v1/essays/ai-status` - AI服务状态检查

Prompt 库管理 API（`/api/v1/prompts`，详见后端 `/docs`）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/prompts` | 模板列表（含已发布内容） |
| POST | `/api/v1/prompts` | 新增模板 |
| GET | `/api/v1/prompts/{id}` | 模板详情（含最新草稿） |
| PUT | `/api/v1/prompts/{id}` | 更新模板元数据 |
| DELETE | `/api/v1/prompts/{id}` | 删除模板（级联删除全部版本） |
| GET | `/api/v1/prompts/{id}/versions` | 版本历史 |
| POST | `/api/v1/prompts/{id}/versions` | 保存新版本（可选发布） |
| POST | `/api/v1/prompts/{id}/publish` | 发布指定版本（对旧版本即回滚） |
| POST | `/api/v1/prompts/{id}/reset` | 重置为内置默认内容 |
| POST | `/api/v1/prompts/{id}/preview` | 服务端渲染预览 |
| GET | `/api/v1/prompts/{id}/diff?a=1&b=2` | 版本行级对比 |

详细的开发指南和配置说明请参考 [CLAUDE.md](CLAUDE.md)。

## 📝 许可证

本项目采用 MIT 许可证。
