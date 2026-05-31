/**
 * 扫描 agency-agents-zh 目录，解析所有 .md 智能体定义文件，
 * 提取 YAML frontmatter，输出 agent-index.json。
 *
 * 用法: node scripts/load-agents.mjs
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '..', 'agency-agents-zh');
const OUTPUT_FILE = join(__dirname, '..', 'agent-index.json');

// 跳过的目录和文件
const SKIP_DIRS = new Set([
  '.git', '.github', 'scripts', 'integrations', 'examples',
  'strategy', 'node_modules',
]);
const SKIP_FILES = new Set([
  'README.md', 'README.zh-TW.md', 'AGENT-LIST.md', 'CATALOG.md',
  'CONTRIBUTING.md', 'UPSTREAM.md', 'LICENSE', 'package.json',
  '.gitignore', '.gitattributes',
]);

// 部门中文名映射
const DEPT_NAMES = {
  engineering: '工程部',
  design: '设计部',
  marketing: '营销部',
  product: '产品部',
  finance: '金融部',
  sales: '销售部',
  specialized: '专家团',
  testing: '测试部',
  support: '支持部',
  hr: '人事部',
  legal: '法务部',
  academic: '学术部',
  'game-development': '游戏开发部',
  'supply-chain': '供应链部',
  'project-management': '项目管理部',
  'paid-media': '投放部',
  'spatial-computing': 'XR部',
  // 游戏开发子目录
  unity: '游戏开发部',
  'unreal-engine': '游戏开发部',
  godot: '游戏开发部',
  'roblox-studio': '游戏开发部',
  blender: '游戏开发部',
};

/**
 * 解析 YAML frontmatter（简单的 --- 分隔格式）
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)/);
    if (m) {
      result[m[1]] = m[2].trim();
    }
  }
  return result;
}

/**
 * 递归扫描目录，收集所有 .md 智能体文件
 */
function scanDir(dir, dept = null) {
  const agents = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      // 子部门归入父部门（如 game-development/unity → game-development）
      const parentDept = dept || entry.name;
      agents.push(...scanDir(join(dir, entry.name), parentDept));
      continue;
    }

    if (!entry.name.endsWith('.md')) continue;
    if (SKIP_FILES.has(entry.name)) continue;

    const filePath = join(dir, entry.name);
    const content = readFileSync(filePath, 'utf-8');
    const meta = parseFrontmatter(content);

    if (!meta.name) continue; // 没有 name 的跳过

    const slug = basename(entry.name, '.md');
    const department = dept || basename(dir);

    agents.push({
      id: slug,
      name: meta.name,
      description: meta.description || '',
      emoji: meta.emoji || '👤',
      color: meta.color || 'gray',
      department,
      departmentName: DEPT_NAMES[department] || department,
      filePath: filePath.replace(AGENTS_DIR + '/', ''),
    });
  }

  return agents;
}

// 执行扫描
console.log('🔍 扫描 agency-agents-zh 目录...');
const agents = scanDir(AGENTS_DIR);

// 按部门分组统计
const byDept = {};
for (const a of agents) {
  (byDept[a.department] ||= []).push(a);
}

console.log(`\n✅ 共加载 ${agents.length} 个智能体：`);
for (const [dept, list] of Object.entries(byDept).sort()) {
  console.log(`  ${DEPT_NAMES[dept] || dept}: ${list.length} 个`);
}

// 输出 JSON
const output = {
  version: '1.0',
  generatedAt: new Date().toISOString(),
  total: agents.length,
  departments: Object.fromEntries(
    Object.entries(byDept).map(([k, v]) => [k, {
      name: DEPT_NAMES[k] || k,
      count: v.length,
    }])
  ),
  agents,
};

writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
console.log(`\n📄 已输出到 ${OUTPUT_FILE}`);
