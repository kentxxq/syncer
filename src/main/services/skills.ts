import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import simpleGit from "simple-git";
import type { SkillInfo } from "../../shared/types";
import { getCacheDir } from "./config";
import { importFromGit } from "./git";

/**
 * 根据 Git URL 生成缓存目录名
 * 复用与 git.ts 相同的命名规则
 */
function getCacheRepoDir(gitUrl: string): string {
  const cleaned = gitUrl
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/[/\\:]/g, "-");
  return path.join(getCacheDir(), cleaned);
}

/**
 * 确保仓库已克隆到缓存目录
 */
async function ensureCloned(gitUrl: string, branch?: string): Promise<string> {
  const repoDir = getCacheRepoDir(gitUrl);

  try {
    if (fs.existsSync(path.join(repoDir, ".git"))) {
      const git = simpleGit(repoDir);
      await git.fetch();
      const targetBranch = branch || "main";
      await git.checkout(targetBranch);
      await git.pull("origin", targetBranch);
      return repoDir;
    }

    const parentDir = path.dirname(repoDir);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    await simpleGit().clone(gitUrl, repoDir, ["--branch", branch || "main"]);
    return repoDir;
  } catch (error: any) {
    throw new Error(`Git 操作失败 (${gitUrl}): ${error.message}`);
  }
}

/**
 * SKILL.md 的标准搜索路径
 * 参考 vercel-labs/skills 的 Skill Discovery 规则
 */
const SKILL_SEARCH_DIRS = [
  ".", // 根目录
  "skills",
  "skills/.curated",
  "skills/.experimental",
  ".agents/skills",
  ".claude/skills",
  ".augment/skills",
  ".cursor/skills",
];

/**
 * 解析 SKILL.md 文件的 YAML frontmatter
 * 返回 { name, description } 或 null（解析失败时）
 */
function parseSkillMd(filePath: string): { name: string; description: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    // 匹配 YAML frontmatter：以 --- 开头和结尾
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;

    const frontmatter = yaml.load(match[1]) as Record<string, any>;
    if (!frontmatter || typeof frontmatter !== "object") return null;

    const name = frontmatter.name;
    const description = frontmatter.description || "";
    if (!name || typeof name !== "string") return null;

    // 跳过标记为 internal 的技能
    if (frontmatter.metadata?.internal === true) return null;

    return { name, description: String(description) };
  } catch {
    return null;
  }
}

/**
 * 递归搜索目录下的所有 SKILL.md
 * maxDepth 用于限制递归深度，避免搜索太深
 */
function findSkillFiles(dir: string, maxDepth = 3, currentDepth = 0): string[] {
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];

  const results: string[] = [];
  const skillMd = path.join(dir, "SKILL.md");
  if (fs.existsSync(skillMd)) {
    results.push(skillMd);
  }

  // 不再深入已有 SKILL.md 的目录的子目录（一个 SKILL.md 代表一个完整 skill）
  if (results.length > 0) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // 跳过 .git 和 node_modules
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      // 跳过与标准搜索路径无关的隐藏目录
      if (entry.name.startsWith(".") && !SKILL_SEARCH_DIRS.some((d) => d.includes(entry.name)))
        continue;

      results.push(...findSkillFiles(path.join(dir, entry.name), maxDepth, currentDepth + 1));
    }
  } catch {
    // 权限不足等情况，跳过
  }

  return results;
}

/**
 * 扫描 Git 仓库中的所有 Skills
 * 1. 先在标准搜索路径中查找
 * 2. 如果标准路径没找到，则递归搜索
 */
export async function scanSkills(gitUrl: string, branch?: string): Promise<SkillInfo[]> {
  const repoDir = await ensureCloned(gitUrl, branch);
  const skills: SkillInfo[] = [];
  const seenPaths = new Set<string>();

  // 第一阶段：在标准搜索路径中查找
  for (const searchDir of SKILL_SEARCH_DIRS) {
    const absSearchDir = path.join(repoDir, searchDir);
    if (!fs.existsSync(absSearchDir)) continue;

    const skillFiles = findSkillFiles(absSearchDir, 2);
    for (const skillFile of skillFiles) {
      const parsed = parseSkillMd(skillFile);
      if (!parsed) continue;

      const skillDir = path.dirname(skillFile);
      const relPath = path.relative(repoDir, skillDir);

      if (seenPaths.has(relPath)) continue;
      seenPaths.add(relPath);

      skills.push({
        name: parsed.name,
        description: parsed.description,
        path: relPath === "." ? "" : relPath,
      });
    }
  }

  // 第二阶段：如果标准路径一个都没找到，递归搜索整个仓库
  if (skills.length === 0) {
    const allSkillFiles = findSkillFiles(repoDir, 4);
    for (const skillFile of allSkillFiles) {
      const parsed = parseSkillMd(skillFile);
      if (!parsed) continue;

      const skillDir = path.dirname(skillFile);
      const relPath = path.relative(repoDir, skillDir);
      if (seenPaths.has(relPath)) continue;
      seenPaths.add(relPath);

      skills.push({
        name: parsed.name,
        description: parsed.description,
        path: relPath === "." ? "" : relPath,
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 批量导入已选中的 Skills
 * 每个 skill 都会创建为一个独立的 Syncer 包（directory 类型，带 Git origin）
 */
export async function batchImportSkills(
  gitUrl: string,
  branch: string,
  skills: { name: string; path: string }[],
): Promise<void> {
  for (const skill of skills) {
    const pkgName = skill.name;
    const subPath = skill.path || ".";
    await importFromGit(pkgName, gitUrl, subPath, branch || "main");
  }
}
