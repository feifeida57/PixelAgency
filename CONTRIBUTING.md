# 🤝 贡献指南

感谢你对 PixelAgency 的兴趣！我们欢迎各种形式的贡献。

## 📋 如何贡献

### 添加新智能体

1. Fork 本仓库
2. 在 `agency-agents-zh/部门名/` 目录下创建新的 `.md` 文件
3. 按照以下模板编写：

```markdown
---
name: 智能体名称
description: 一句话描述这个智能体的职责
emoji: 🎯
color: "#FF6B6B"
---

# 智能体名称

## 角色定义
你是「智能体名称」，专注于...

## 核心能力
- 能力 1
- 能力 2
- 能力 3

## 工作流程
1. 第一步
2. 第二步
3. 第三步

## 输出规范
- 格式要求
- 质量标准
```

4. 运行 `node scripts/load-agents.mjs` 更新索引
5. 提交 Pull Request

### 添加新部门

1. 在 `agency-agents-zh/` 下创建新目录
2. 添加至少一个智能体文件
3. 更新 `scripts/load-agents.mjs` 中的部门映射（如有必要）
4. 提交 Pull Request

### 报告 Bug

使用 [Issue 模板](https://github.com/feifeida57/PixelAgency/issues/new?template=bug_report.md) 报告问题。

### 提出新功能

使用 [Feature Request 模板](https://github.com/feifeida57/PixelAgency/issues/new?template=feature_request.md) 提出建议。

## 📝 智能体编写规范

### 命名规则
- 文件名：`部门-角色名.md`（小写，连字符分隔）
- 示例：`engineering-frontend-developer.md`

### 内容要求
- **必须**：YAML frontmatter（name, description, emoji, color）
- **必须**：清晰的角色定义
- **建议**：具体的工作流程
- **建议**：输出格式规范

### Emoji 选择
- 使用能代表角色的 emoji
- 避免与其他同部门智能体重复

### 颜色选择
- 使用 HEX 格式（如 `#FF6B6B`）
- 颜色应与角色调性匹配

## 🔧 开发环境

### 前置要求
- Node.js 18+
- Git

### 本地开发
```bash
# 克隆仓库
git clone https://github.com/feifeida57/PixelAgency.git
cd PixelAgency

# 生成智能体索引
node scripts/load-agents.mjs

# 查看生成的索引
cat agent-index.json | head -20
```

## 📜 Pull Request 规范

### PR 标题
```
<type>: <description>
```

类型：
- `feat`: 新功能（新智能体、新部门）
- `fix`: 修复（修正智能体描述、修复脚本）
- `docs`: 文档更新
- `refactor`: 重构

### PR 描述
- 说明做了什么
- 关联相关 Issue（如有）
- 截图（如涉及 UI 变更）

### 提交前检查
- [ ] 智能体文件格式正确
- [ ] 运行 `node scripts/load-agents.mjs` 无报错
- [ ] agent-index.json 已更新
- [ ] README.md 已更新（如需）

## 🎯 当前优先级

查看 [Issues](https://github.com/feifeida57/PixelAgency/issues) 了解当前需要帮助的任务。

标有 `good first issue` 的任务适合新贡献者。

## 📞 联系方式

- Issue：用于 bug 报告和功能请求
- Discussion：用于问答和讨论（如开启）

## 🙏 致谢

感谢所有贡献者！

---

<p align="center">
  <i>每一个智能体都是 PixelAgency 的一员</i>
</p>
