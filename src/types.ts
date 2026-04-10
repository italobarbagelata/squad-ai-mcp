// Types for the squad-ai-app backend API

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  repoUrl: string | null;
  gitProvider: string | null;
  localPath: string | null;
  defaultModel: string | null;
  agentProfileId: string | null;
  repositories: ProjectRepository[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRepository {
  id: string;
  projectId: string;
  label: string;
  repoUrl: string;
  gitProvider: string;
  defaultBranch: string;
  isPrimary: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string | null;
  executionStatus: string;
  assignedAgentId: string | null;
  conversationId: string | null;
  gitBranch: string | null;
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  agentProfileId: string;
  userId: string;
  taskId: string | null;
  title: string | null;
  status: string;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface PreviewStatus {
  configId: string;
  name: string;
  status: string;
  url: string | null;
  port: number | null;
  error: string | null;
  logs: string | null;
}

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  isActive: boolean;
  totalRuns: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface WikiStatus {
  projectId: string;
  totalSections: number;
  generatedSections: number;
  sections: { slug: string; title: string; exists: boolean; updatedAt: string | null }[];
}

export interface CostBreakdown {
  totalCostUsd: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  byModel: { model: string; costUsd: number }[];
}
