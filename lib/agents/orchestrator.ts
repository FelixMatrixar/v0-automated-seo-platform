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

IMPORTANT: You MUST call the createProposal tool for EACH issue you find. Do not just describe the issues - actually create proposals.

Analyze each file and create improvement proposals. For each issue found, call createProposal with:
- A clear title describing the fix
- A detailed description of why this matters for SEO
- The proposal type (seo_meta, content, component, or performance)
- The file path
- The original code snippet if applicable
- The proposed improved code

Focus on:
1. Missing or incomplete metadata (title, description, OG tags)
2. Heading structure issues (missing H1, multiple H1s, poor hierarchy)
3. Image optimization opportunities (missing alt text, not using next/image)
4. Performance-related SEO issues (client components that could be server)
5. Structured data opportunities

Even if the code looks good, create at least one proposal for potential improvements.`,
      options: {
        repositoryId: repository.id,
        userId,
        scanType,
      },
    })

    const durationMs = Date.now() - startTime

    // Extract proposals from tool results - check both toolResults and steps
    let proposals: unknown[] = []
    
    // Try extracting from toolResults directly
    if (result.toolResults && Array.isArray(result.toolResults)) {
      proposals = result.toolResults
        .filter((r: { toolName: string }) => r.toolName === 'createProposal')
        .map((r: { result: unknown }) => r.result)
    }
    
    // If no proposals found, try extracting from steps
    if (proposals.length === 0 && result.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        if (step.toolCalls && Array.isArray(step.toolCalls)) {
          for (const toolCall of step.toolCalls) {
            if (toolCall.toolName === 'createProposal' && toolCall.result) {
              proposals.push(toolCall.result)
            }
          }
        }
        if (step.toolResults && Array.isArray(step.toolResults)) {
          for (const toolResult of step.toolResults) {
            if (toolResult.toolName === 'createProposal' && toolResult.result) {
              proposals.push(toolResult.result)
            }
          }
        }
      }
    }
    
    console.log('[v0] SEO Scan result:', {
      stepsCount: result.steps?.length,
      toolResultsCount: result.toolResults?.length,
      proposalsFound: proposals.length,
      text: result.text?.slice(0, 200),
    })

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
