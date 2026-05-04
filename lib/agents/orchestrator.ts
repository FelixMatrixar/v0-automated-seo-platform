import { createClient } from '@/lib/supabase/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
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

// Schema for SEO analysis proposals
const ProposalSchema = z.object({
  title: z.string().describe('Clear title describing the SEO fix'),
  description: z.string().describe('Why this matters for SEO'),
  proposal_type: z.enum(['seo_meta', 'content', 'component', 'performance']),
  file_path: z.string().describe('Path to the file that needs changes'),
  original_content: z.string().nullable().describe('Original code snippet'),
  proposed_content: z.string().describe('Proposed improved code'),
  priority: z.enum(['high', 'medium', 'low']).describe('Impact priority'),
})

const SEOAnalysisSchema = z.object({
  proposals: z.array(ProposalSchema).describe('List of SEO improvement proposals'),
  summary: z.string().describe('Brief summary of the analysis'),
})

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
      .map(f => `### File: ${f.path}\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\``)
      .join('\n\n')

    // Use generateText with structured output
    const result = await generateText({
      model: 'google/gemini-2.5-flash-lite',
      system: `You are an expert SEO analyst for Next.js/React applications. 
Your job is to analyze code files and identify SEO improvement opportunities.

Always provide actionable proposals with specific code changes. Focus on:
1. Page metadata (title, description, Open Graph tags, Twitter cards)
2. Heading structure (H1 presence, heading hierarchy)
3. Image optimization (alt text, next/image usage)
4. Semantic HTML and accessibility
5. Performance optimizations (server vs client components)
6. Structured data (JSON-LD schemas)

For each issue, provide the exact code that should be added or changed.`,
      prompt: `Analyze these files from "${repository.full_name}" and create SEO improvement proposals:

${fileList}

Create at least 2-3 proposals per file analyzed. Be specific with code suggestions.`,
      output: Output.object({
        schema: SEOAnalysisSchema,
      }),
    })

    const durationMs = Date.now() - startTime
    const analysis = result.output

    if (!analysis || !analysis.proposals) {
      throw new Error('No analysis output received from AI')
    }

    // Save proposals to database
    const supabase = await createClient()
    const savedProposals: Proposal[] = []

    for (const proposal of analysis.proposals) {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          repository_id: repository.id,
          title: proposal.title,
          description: proposal.description,
          proposal_type: proposal.proposal_type,
          file_path: proposal.file_path,
          original_content: proposal.original_content,
          proposed_content: proposal.proposed_content,
          status: 'pending',
        })
        .select()
        .single()

      if (!error && data) {
        savedProposals.push(data as Proposal)
      }
    }

    console.log('[v0] SEO Scan result:', {
      proposalsGenerated: analysis.proposals.length,
      proposalsSaved: savedProposals.length,
      summary: analysis.summary,
    })

    await logAgentActivity({
      userId,
      repositoryId: repository.id,
      agentType: 'researcher',
      action: `Completed ${scanType} SEO scan for ${repository.full_name}`,
      status: 'completed',
      outputData: { 
        proposalCount: savedProposals.length,
        summary: analysis.summary,
      },
      durationMs,
    })

    return {
      success: true,
      proposals: savedProposals,
      summary: analysis.summary,
      duration: durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error('[v0] SEO Scan error:', errorMessage)

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
    // Generate implementation details
    const result = await generateText({
      model: 'google/gemini-2.5-flash-lite',
      system: `You are an expert developer implementing SEO improvements.
Generate complete, production-ready code changes based on the proposal.`,
      prompt: `Implement this SEO improvement:

Title: ${proposal.title}
Description: ${proposal.description}
Type: ${proposal.proposal_type}
File: ${proposal.file_path}

Original code:
\`\`\`
${proposal.original_content || 'No original content provided'}
\`\`\`

Proposed changes:
\`\`\`
${proposal.proposed_content}
\`\`\`

Generate the final implementation code that can be committed.`,
      output: Output.object({
        schema: z.object({
          file_path: z.string(),
          content: z.string().describe('The complete file content after changes'),
          commit_message: z.string().describe('Git commit message'),
          branch_name: z.string().describe('Suggested branch name'),
        }),
      }),
    })

    const durationMs = Date.now() - startTime
    const implementation = result.output

    await logAgentActivity({
      userId,
      repositoryId: repository.id,
      proposalId: proposal.id,
      agentType: 'implementation',
      action: `Completed implementation for proposal: ${proposal.title}`,
      status: 'completed',
      outputData: {
        branch_name: implementation?.branch_name,
        commit_message: implementation?.commit_message,
      },
      durationMs,
    })

    return {
      success: true,
      implementation,
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
    const result = await generateText({
      model: 'google/gemini-2.5-flash-lite',
      system: `You are creating Discord notification messages for SEO proposals.
Create engaging, clear messages with proper formatting.`,
      prompt: `Create a Discord message for: ${action}

Proposal: ${proposal.title}
Description: ${proposal.description}
Status: ${proposal.status}
Type: ${proposal.proposal_type}
${proposal.preview_url ? `Preview: ${proposal.preview_url}` : ''}
${proposal.pr_url ? `PR: ${proposal.pr_url}` : ''}

${additionalData ? `Additional info: ${JSON.stringify(additionalData)}` : ''}`,
      output: Output.object({
        schema: z.object({
          title: z.string(),
          description: z.string(),
          color: z.number().describe('Discord embed color as integer'),
          fields: z.array(z.object({
            name: z.string(),
            value: z.string(),
            inline: z.boolean().optional(),
          })),
        }),
      }),
    })

    const durationMs = Date.now() - startTime

    await logAgentActivity({
      userId,
      proposalId: proposal.id,
      agentType: 'facilitator',
      action: `Created Discord notification for ${action}`,
      status: 'completed',
      outputData: result.output,
      durationMs,
    })

    return {
      success: true,
      message: result.output,
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
