import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../api-client.js";
import type { Project, Task, Session, PreviewStatus, Schedule, WikiStatus, CostBreakdown } from "../types.js";

export function registerSquadTools(server: McpServer): void {

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS (Backlog)
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_list_tasks",
    "Lista las tareas del backlog del proyecto con su estado. Úsala para ver qué hay pendiente, en progreso o completado.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const tasks = await api<Task[]>(`/api/projects/${projectId}/tasks`);
      if (!tasks.length) return text("No hay tareas en el backlog.");

      const groups: Record<string, Task[]> = {};
      for (const t of tasks) {
        const g = groups[t.executionStatus] ??= [];
        g.push(t);
      }

      const lines = ["## Backlog\n"];
      for (const [status, items] of Object.entries(groups)) {
        lines.push(`### ${status} (${items.length})`);
        for (const t of items) {
          lines.push(`- **${t.key}** — ${t.title}`);
        }
      }
      lines.push(`\n**Total: ${tasks.length} tareas**`);
      return text(lines.join("\n"));
    },
  );

  server.tool(
    "squad_get_task",
    "Obtiene el detalle completo de una tarea: título, descripción, estado, branch, PR.",
    {
      projectId: z.string().describe("ID del proyecto"),
      taskId: z.string().describe("ID de la tarea"),
    },
    async ({ projectId, taskId }) => {
      const task = await api<Task>(`/api/projects/${projectId}/tasks/${taskId}`);
      const lines = [
        `## ${task.key} — ${task.title}`,
        `**Estado:** ${task.executionStatus}`,
        task.description ? `**Descripción:**\n${task.description}` : "",
        task.gitBranch ? `**Branch:** \`${task.gitBranch}\`` : "",
        task.prUrl ? `**PR:** ${task.prUrl}` : "",
      ].filter(Boolean);
      return text(lines.join("\n"));
    },
  );

  server.tool(
    "squad_create_task",
    "Crea una nueva tarea en el backlog del proyecto.",
    {
      projectId: z.string().describe("ID del proyecto"),
      title: z.string().describe("Título de la tarea"),
      description: z.string().optional().describe("Descripción detallada"),
    },
    async ({ projectId, title, description }) => {
      const task = await api<Task>(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, description }),
      });
      return text(`✅ Tarea creada: **${task.key}** — ${task.title}`);
    },
  );

  server.tool(
    "squad_update_task",
    "Actualiza una tarea existente (título, descripción).",
    {
      projectId: z.string().describe("ID del proyecto"),
      taskId: z.string().describe("ID de la tarea"),
      title: z.string().optional().describe("Nuevo título"),
      description: z.string().optional().describe("Nueva descripción"),
    },
    async ({ projectId, taskId, title, description }) => {
      const body: Record<string, string> = {};
      if (title) body.title = title;
      if (description) body.description = description;
      await api(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return text(`✅ Tarea actualizada`);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW (Start/Stop/Status/Logs)
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_preview_status",
    "Muestra el estado del preview del proyecto: servicios corriendo, URLs, errores y los últimos logs.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const statuses = await api<PreviewStatus[]>(`/api/projects/${projectId}/preview/status`);
      if (!statuses.length) return text("No hay servicios de preview configurados.");

      const lines = ["## Preview Status\n"];
      for (const s of statuses) {
        const emoji = s.status === "running" ? "🟢" : s.status === "building" ? "🔨" : s.status === "exited" ? "🔴" : "⚪";
        lines.push(`${emoji} **${s.name}** — ${s.status}${s.url ? ` → ${s.url}` : ""}`);
        if (s.error) lines.push(`  ❌ Error: ${s.error}`);
        if (s.logs) {
          const lastLines = s.logs.trim().split("\n").slice(-15).join("\n");
          lines.push(`  \`\`\`\n${lastLines}\n  \`\`\``);
        }
      }
      return text(lines.join("\n"));
    },
  );

  server.tool(
    "squad_preview_start",
    "Levanta el preview del proyecto (todos los servicios o uno específico).",
    {
      projectId: z.string().describe("ID del proyecto"),
      serviceId: z.string().optional().describe("ID del servicio específico (opcional)"),
    },
    async ({ projectId, serviceId }) => {
      const qs = serviceId ? `?service_id=${serviceId}` : "";
      await api(`/api/projects/${projectId}/preview/start${qs}`, { method: "POST" });
      return text("▶️ Preview iniciando...");
    },
  );

  server.tool(
    "squad_preview_stop",
    "Detiene el preview del proyecto (todos los servicios o uno específico).",
    {
      projectId: z.string().describe("ID del proyecto"),
      serviceId: z.string().optional().describe("ID del servicio específico (opcional)"),
    },
    async ({ projectId, serviceId }) => {
      const qs = serviceId ? `?service_id=${serviceId}` : "";
      await api(`/api/projects/${projectId}/preview/stop${qs}`, { method: "POST" });
      return text("⏹️ Preview detenido.");
    },
  );

  server.tool(
    "squad_preview_logs",
    "Obtiene los logs completos (build + runtime) de un servicio del preview.",
    {
      projectId: z.string().describe("ID del proyecto"),
      configId: z.string().describe("ID del servicio/config"),
    },
    async ({ projectId, configId }) => {
      const data = await api<{ build_logs: string | null; runtime_logs: string | null }>(
        `/api/projects/${projectId}/preview/logs/${configId}`
      );
      const lines = ["## Logs\n"];
      if (data.build_logs) lines.push(`### Build\n\`\`\`\n${data.build_logs.slice(-3000)}\n\`\`\``);
      if (data.runtime_logs) lines.push(`### Runtime\n\`\`\`\n${data.runtime_logs.slice(-3000)}\n\`\`\``);
      if (!data.build_logs && !data.runtime_logs) lines.push("Sin logs disponibles.");
      return text(lines.join("\n"));
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // GIT
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_git_branches",
    "Lista las ramas del repositorio del proyecto y cuál está activa.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const data = await api<{ branches: { name: string; isCurrent: boolean }[]; current: string }>(
        `/api/projects/${projectId}/preview/branches`
      );
      const lines = [`## Branches (actual: \`${data.current}\`)\n`];
      for (const b of data.branches) {
        lines.push(`${b.isCurrent ? "→" : " "} \`${b.name}\``);
      }
      return text(lines.join("\n"));
    },
  );

  server.tool(
    "squad_git_checkout",
    "Cambia de branch en el repositorio del proyecto.",
    {
      projectId: z.string().describe("ID del proyecto"),
      branch: z.string().describe("Nombre del branch"),
    },
    async ({ projectId, branch }) => {
      await api(`/api/projects/${projectId}/preview/checkout?branch=${encodeURIComponent(branch)}`, {
        method: "POST",
      });
      return text(`✅ Cambiado a branch \`${branch}\``);
    },
  );

  server.tool(
    "squad_git_diff",
    "Muestra los cambios pendientes (diff) del repositorio.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const data = await api<{ files: { path: string; status: string; diff?: string }[] }>(
        `/api/projects/${projectId}/git/diff`
      );
      if (!data.files.length) return text("Sin cambios pendientes.");
      const lines = ["## Cambios pendientes\n"];
      for (const f of data.files) {
        lines.push(`### ${f.status} ${f.path}`);
        if (f.diff) lines.push(`\`\`\`\n${f.diff.slice(0, 2000)}\n\`\`\``);
      }
      return text(lines.join("\n"));
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_list_sessions",
    "Lista las sessions de chat del proyecto.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const sessions = await api<Session[]>(`/api/projects/${projectId}/sessions`);
      if (!sessions.length) return text("No hay sessions.");
      const lines = ["## Sessions\n"];
      for (const s of sessions) {
        const status = s.status === "active" ? "🟢" : "⚪";
        lines.push(`${status} **${s.title || "Sin título"}** (\`${s.id}\`) — $${s.totalCostUsd.toFixed(4)}`);
      }
      return text(lines.join("\n"));
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULES
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_list_schedules",
    "Lista las tareas programadas (schedules/cron) del proyecto.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const schedules = await api<Schedule[]>(`/api/projects/${projectId}/schedules`);
      if (!schedules.length) return text("No hay schedules configurados.");
      const lines = ["## Schedules\n"];
      for (const s of schedules) {
        const active = s.isActive ? "🟢" : "⚪";
        lines.push(`${active} **${s.name}** — \`${s.cronExpression}\` — ${s.totalRuns} ejecuciones`);
        if (s.nextRunAt) lines.push(`  Próxima: ${s.nextRunAt}`);
      }
      return text(lines.join("\n"));
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // WIKI
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_wiki_status",
    "Muestra el estado de la wiki auto-generada del proyecto.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const status = await api<WikiStatus>(`/api/projects/${projectId}/wiki/status`);
      const lines = [`## Wiki (${status.generatedSections}/${status.totalSections} secciones)\n`];
      for (const s of status.sections) {
        const icon = s.exists ? "✅" : "○";
        lines.push(`${icon} **${s.title}**${s.updatedAt ? ` — ${s.updatedAt}` : ""}`);
      }
      return text(lines.join("\n"));
    },
  );

  server.tool(
    "squad_wiki_generate",
    "Genera o regenera toda la wiki del proyecto automáticamente desde el código.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      // This is a long operation — just trigger it
      await api(`/api/projects/${projectId}/wiki/generate`, { method: "POST" });
      return text("🔄 Wiki generándose... Revisa el estado con squad_wiki_status.");
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // COSTS & METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "squad_costs",
    "Muestra el desglose de costos del proyecto (tokens y USD por modelo).",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const data = await api<CostBreakdown>(`/api/projects/${projectId}/costs/breakdown`);
      const lines = [
        `## Costos`,
        `**Total:** $${data.totalCostUsd.toFixed(4)}`,
        `**Tokens:** ${data.totalTokensInput.toLocaleString()} in / ${data.totalTokensOutput.toLocaleString()} out`,
        `\n### Por modelo`,
      ];
      for (const m of data.byModel) {
        lines.push(`- **${m.model}**: $${m.costUsd.toFixed(4)}`);
      }
      return text(lines.join("\n"));
    },
  );

  server.tool(
    "squad_project_info",
    "Muestra información general del proyecto: nombre, repo, modelo, estado.",
    { projectId: z.string().describe("ID del proyecto") },
    async ({ projectId }) => {
      const p = await api<Project>(`/api/projects/${projectId}`);
      const lines = [
        `## ${p.name}`,
        p.description ? `${p.description}` : "",
        `**Estado:** ${p.status}`,
        p.repoUrl ? `**Repo:** ${p.repoUrl}` : "",
        p.defaultModel ? `**Modelo:** ${p.defaultModel}` : "",
        `**Repos:** ${p.repositories.length}`,
      ].filter(Boolean);
      return text(lines.join("\n"));
    },
  );
}

// Helper
function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
