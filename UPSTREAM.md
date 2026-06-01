# 📦 上游来源与原创声明

## 上游项目

### agency-agents-zh

- **来源**: [nicepkg/agency-agents-zh](https://github.com/nicepkg/agency-agents-zh)
- **用途**: 215 位 AI 智能体定义文件
- **许可证**: MIT
- **使用方式**: 作为智能体定义的数据源

我们使用了 agency-agents-zh 项目中的智能体定义文件（.md），这些文件定义了各个专业领域的 AI 智能体角色、能力和工作流程。

## 原创部分

以下内容是 PixelAgency 项目的原创：

### 1. 虚拟办公室系统
- Canvas 2D 像素风渲染引擎
- 7 种智能体行为状态系统
- 动态布局算法
- 动画系统（发光、走动、气泡）

### 2. LLM 秘书系统
- `prompts/secretary.md` — 秘书系统提示词
- `PILOTDECK.md` — PilotDeck 集成配置
- 智能调度判断逻辑

### 3. 状态同步系统
- WebSocket 实时事件监听
- 角色名解析算法
- localStorage 状态持久化

### 4. 工具链
- `scripts/load-agents.mjs` — 智能体索引生成器
- `agent-index.json` — 标准化索引格式

### 5. 前端组件
- `VirtualOfficeV2.tsx` — 虚拟办公室 React 组件
- 部门选择器
- 智能体详情弹窗

## 致谢

感谢 [nicepkg](https://github.com/nicepkg) 提供的 agency-agents-zh 项目，为 PixelAgency 提供了丰富的智能体定义。

## 引用

如果你在项目中使用了 PixelAgency，请引用：

```markdown
PixelAgency - 215位AI智能体虚拟办公室
https://github.com/feifeida57/PixelAgency
```
