import type { AgentTarget } from "./types";

/**
 * 常用 AI 编码工具的 skills 路径配置表
 * 参考 https://github.com/vercel-labs/skills 的 Supported Agents
 */
export const AGENT_TARGETS: AgentTarget[] = [
  {
    label: "Antigravity",
    id: "antigravity",
    globalPath: "~/.gemini/antigravity/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "Claude Code",
    id: "claude-code",
    globalPath: "~/.claude/skills",
    projectPath: ".claude/skills",
  },
  {
    label: "Cursor",
    id: "cursor",
    globalPath: "~/.cursor/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "Gemini CLI",
    id: "gemini-cli",
    globalPath: "~/.gemini/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "GitHub Copilot",
    id: "github-copilot",
    globalPath: "~/.copilot/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "Codex",
    id: "codex",
    globalPath: "~/.codex/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "Windsurf",
    id: "windsurf",
    globalPath: "~/.codeium/windsurf/skills",
    projectPath: ".windsurf/skills",
  },
  {
    label: "Cline",
    id: "cline",
    globalPath: "~/.agents/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "Roo Code",
    id: "roo",
    globalPath: "~/.roo/skills",
    projectPath: ".roo/skills",
  },
  {
    label: "OpenCode",
    id: "opencode",
    globalPath: "~/.config/opencode/skills",
    projectPath: ".agents/skills",
  },
  {
    label: "Trae",
    id: "trae",
    globalPath: "~/.trae/skills",
    projectPath: ".trae/skills",
  },
  {
    label: "Kiro CLI",
    id: "kiro-cli",
    globalPath: "~/.kiro/skills",
    projectPath: ".kiro/skills",
  },
];
