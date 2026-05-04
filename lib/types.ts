export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  github_username: string | null
  github_access_token: string | null
  created_at: string
  updated_at: string
}

export interface Repository {
  id: string
  user_id: string
  github_repo_id: number
  full_name: string
  default_branch: string
  seo_config: SEOConfig
  is_active: boolean
  last_scan_at: string | null
  created_at: string
  updated_at: string
}

export interface SEOConfig {
  scan_frequency?: 'daily' | 'weekly' | 'manual'
  target_keywords?: string[]
  excluded_paths?: string[]
  auto_create_proposals?: boolean
  discord_channel_id?: string
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'deployed' | 'merged'
export type ProposalType = 'seo_meta' | 'content' | 'component' | 'performance'

export interface Proposal {
  id: string
  repository_id: string
  title: string
  description: string | null
  status: ProposalStatus
  proposal_type: ProposalType
  file_path: string | null
  original_content: string | null
  proposed_content: string | null
  v0_session_id: string | null
  branch_name: string | null
  pr_number: number | null
  pr_url: string | null
  preview_url: string | null
  discord_message_id: string | null
  discord_thread_id: string | null
  feedback: DiscordFeedback[]
  created_at: string
  updated_at: string
  // Joined fields
  repository?: Repository
}

export type AgentType = 'researcher' | 'implementation' | 'facilitator'
export type AgentStatus = 'running' | 'completed' | 'failed'

export interface AgentLog {
  id: string
  user_id: string | null
  repository_id: string | null
  proposal_id: string | null
  agent_type: AgentType
  action: string
  status: AgentStatus
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

export type FeedbackAction = 'approve' | 'reject' | 'comment' | 'request_changes'

export interface DiscordFeedback {
  id: string
  proposal_id: string
  discord_user_id: string
  discord_username: string | null
  action: FeedbackAction
  comment: string | null
  created_at: string
}

// GitHub API types
export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  default_branch: string
  html_url: string
  clone_url: string
  language: string | null
  updated_at: string
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
  }
}

export interface GitHubPullRequest {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  merged: boolean
}

// Agent tool types
export interface SEOAnalysis {
  page_url: string
  title: {
    current: string
    suggestions: string[]
    score: number
  }
  meta_description: {
    current: string | null
    suggestions: string[]
    score: number
  }
  headings: {
    h1_count: number
    h2_count: number
    issues: string[]
  }
  keywords: {
    found: string[]
    missing: string[]
    density: Record<string, number>
  }
  performance: {
    issues: string[]
    suggestions: string[]
  }
  overall_score: number
}

export interface ComponentGenerationRequest {
  proposal_id: string
  component_type: string
  requirements: string
  existing_code?: string
  style_preferences?: string
}

export interface DeploymentStatus {
  proposal_id: string
  branch_name: string
  pr_url: string | null
  preview_url: string | null
  status: 'creating_branch' | 'committing' | 'creating_pr' | 'deploying' | 'ready' | 'failed'
  error?: string
}
