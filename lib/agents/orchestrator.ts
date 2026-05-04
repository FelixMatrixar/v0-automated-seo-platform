import { createClient } from '@/lib/supabase/server'
import { researcherAgent } from './researcher'
import { implementationAgent } from './implementation'
import { facilitatorAgent } from './facilitator'
import type { Repository, Proposal, AgentType, AgentStatus } from '@/lib/types'

interface AgentLogEntry {
  userId: string
  repositoryId?: string
  proposalId?: string
  agentType: AgentType
  action: string
  status: AgentStatus
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  errorMessage?: string
  durationMs?: number
}

async function logAgentActivity(entry: AgentLogEntry) {
  const supabase = await createClient()
  await supabase.from('agent_logs').insert({
    user_id: entry.userId,
    repository_id: entry.repositoryId,
    proposal_id: entry.proposalId,
    agent_type: entry.agentType,
    action: entry.action,
    status: entry.status,
    input_data: entry.inputData,
    output_data: entry.outputData,
    error_message: entry.errorMessage,
    duration_ms: entry.durationMs,
  })
}

export async function runSEOScan(
  repository: Repository,
  userId: string,
  fileContents: { path: string; content: string }[],
  scanType: 'full' | 'quick' | 'metadata_only' = 'full'
) {
  const startTime = Date.now()
  
  await logAgentActivity({
    userId,
    repositoryId: repository.id,
    agentType: 'researcher',
    action: `Starting ${scanType} SEO scan for ${repository.full_name}`,
    status: 'running',
  })

  try {
    // Build the analysis prompt with file contents
    const fileList = fileContents
      .map(f => `File: ${f.path}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``)
      .join('\n\n')

    const result = await researcherAgent.generate({
      prompt: `Analyze the following files from the repository "${repository.full_name}" for SEO improvements.
      
${fileList}

Please analyze each file and create improvement proposals where needed. Focus on:
1. Missing or incomplete metadata
2. Heading structure issues
3. Image optimization opportunities
4. Performance-related SEO issues
5. Structured data opportunities

Use the createProposal tool for each improvement you identify.`,
      options: {
        repositoryId: repository.id,
        userId,
        scanType,
      },
    })

    const durationMs = Date.now() - startTime

    // Extract proposals from tool results
    const proposals = result.toolResults
      .filter((r: { toolName: string }) => r.toolName === 'createProposal')
      .map((r: { result: unknown }) => r.result)

    await logAgentActivity({
      userId,
      repositoryId: repository.id,
      agentType: 'researcher',
      action: `Completed ${scanType} SEO scan for ${repository.full_name}`,
      status: 'completed',
      outputData: { proposalCount: proposals.length },
      durationMs,
    })

    return {
      success: true,
      proposals,
      steps: result.steps.length,
      duration: durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAgentActivity({
      userId,
      repositoryId: repository.id,
      agentType: 'researcher',
      action: `Failed SEO scan for ${repository.full_name}`,
      status: 'failed',
      errorMessage,
      durationMs,
    })

    return {
      success: false,
      error: errorMessage,
      proposals: [],
      duration: durationMs,
    }
  }
}

export async function implementProposal(
  proposal: Proposal,
  repository: Repository,
  userId: string
) {
  const startTime = Date.now()

  await logAgentActivity({
    userId,
    repositoryId: repository.id,
    proposalId: proposal.id,
    agentType: 'implementation',
    action: `Starting implementation for proposal: ${proposal.title}`,
    status: 'running',
  })

  try {
    const result = await implementationAgent.generate({
      prompt: `Implement the following SEO improvement proposal:

Title: ${proposal.title}
Description: ${proposal.description}
Type: ${proposal.proposal_type}
File Path: ${proposal.file_path}

${proposal.original_content ? `Original Content:\n\`\`\`\n${proposal.original_content}\n\`\`\`` : ''}

${proposal.proposed_content ? `Proposed Changes:\n\`\`\`\n${proposal.proposed_content}\n\`\`\`` : ''}

Generate the necessary code changes and prepare them for a Git commit.
Use the prepareGitCommit tool when the implementation is complete.`,
      options: {
        proposalId: proposal.id,
        repositoryId: repository.id,
        userId,
      },
    })

    const durationMs = Date.now() - startTime

    // Extract commit preparation from results
    const commitPrep = result.toolResults.find(
      (r: { toolName: string }) => r.toolName === 'prepareGitCommit'
    )

    await logAgentActivity({
      userId,
      repositoryId: repository.id,
      proposalId: proposal.id,
      agentType: 'implementation',
      action: `Completed implementation for proposal: ${proposal.title}`,
      status: 'completed',
      outputData: commitPrep?.result,
      durationMs,
    })

    return {
      success: true,
      commitData: commitPrep?.result,
      steps: result.steps.length,
      duration: durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAgentActivity({
      userId,
      repositoryId: repository.id,
      proposalId: proposal.id,
      agentType: 'implementation',
      action: `Failed implementation for proposal: ${proposal.title}`,
      status: 'failed',
      errorMessage,
      durationMs,
    })

    return {
      success: false,
      error: errorMessage,
      duration: durationMs,
    }
  }
}

export async function notifyDiscord(
  proposal: Proposal,
  action: 'new_proposal' | 'status_update' | 'deployment_ready',
  userId: string,
  additionalData?: Record<string, unknown>
) {
  const startTime = Date.now()

  await logAgentActivity({
    userId,
    proposalId: proposal.id,
    agentType: 'facilitator',
    action: `Creating Discord notification for ${action}`,
    status: 'running',
  })

  try {
    let prompt = ''

    if (action === 'new_proposal') {
      prompt = `Create a Discord message for a new SEO proposal:
Title: ${proposal.title}
Description: ${proposal.description}
Type: ${proposal.proposal_type}
File: ${proposal.file_path}
Proposal ID: ${proposal.id}

Use the formatProposalMessage tool to create an engaging Discord embed.`
    } else if (action === 'status_update') {
      prompt = `Create a status update message for proposal ${proposal.id}:
New Status: ${proposal.status}
${additionalData?.previousStatus ? `Previous Status: ${additionalData.previousStatus}` : ''}
${additionalData?.updatedBy ? `Updated By: ${additionalData.updatedBy}` : ''}

Use the formatStatusUpdate tool.`
    } else if (action === 'deployment_ready') {
      prompt = `Create a deployment notification for proposal ${proposal.id}:
Title: ${proposal.title}
Preview URL: ${proposal.preview_url}
PR URL: ${proposal.pr_url}
Branch: ${proposal.branch_name}

Use the formatDeploymentNotification tool.`
    }

    const result = await facilitatorAgent.generate({
      prompt,
      options: {
        proposalId: proposal.id,
        userId,
      },
    })

    const durationMs = Date.now() - startTime

    // Extract the formatted message
    const messageResult = result.toolResults[0]?.result

    await logAgentActivity({
      userId,
      proposalId: proposal.id,
      agentType: 'facilitator',
      action: `Created Discord notification for ${action}`,
      status: 'completed',
      outputData: messageResult,
      durationMs,
    })

    return {
      success: true,
      message: messageResult,
      duration: durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAgentActivity({
      userId,
      proposalId: proposal.id,
      agentType: 'facilitator',
      action: `Failed to create Discord notification for ${action}`,
      status: 'failed',
      errorMessage,
      durationMs,
    })

    return {
      success: false,
      error: errorMessage,
      duration: durationMs,
    }
  }
}
