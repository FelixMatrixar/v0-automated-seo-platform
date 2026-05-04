import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { sendDiscordFollowUp } from '@/lib/discord'

export const maxDuration = 60

interface FeedbackRequest {
  feedback: string
  repositoryId: string
  discordUserId: string
  discordUsername: string
  channelId: string
  interactionToken: string
  applicationId: string
}

export async function POST(request: Request) {
  try {
    const params: FeedbackRequest = await request.json()
    const { feedback, repositoryId, discordUsername, interactionToken, applicationId } = params

    const supabase = await createClient()

    // Get repository details
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('*, profile:profiles(github_access_token)')
      .eq('id', repositoryId)
      .single()

    if (repoError || !repository) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: 'Repository not found. Please check your configuration.',
      })
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // Log the agent activity
    await supabase.from('agent_logs').insert({
      user_id: repository.user_id,
      repository_id: repositoryId,
      agent_type: 'researcher',
      action: 'analyze_feedback',
      status: 'running',
      input_data: { feedback, discordUsername },
    })

    // Use AI to analyze the feedback and create a plan
    const analysisResult = await generateText({
      model: 'anthropic/claude-sonnet-4-20250514',
      system: `You are an expert SEO and web development analyst. Analyze user feedback and determine what changes need to be made to improve their website.

Repository: ${repository.full_name}
Current SEO Config: ${JSON.stringify(repository.seo_config || {})}

Based on the feedback, determine:
1. What type of change is needed (seo_meta, content, component, performance)
2. What specific file(s) might need to be modified
3. A clear title for the proposal
4. A detailed description of what changes to make
5. The priority level (high, medium, low)

Be specific and actionable.`,
      prompt: `Analyze this feedback from ${discordUsername}:\n\n"${feedback}"`,
      tools: {
        createProposal: tool({
          description: 'Create a proposal for the suggested changes',
          inputSchema: z.object({
            title: z.string().describe('Short, clear title for the proposal'),
            description: z.string().describe('Detailed description of what changes to make'),
            proposalType: z.enum(['seo_meta', 'content', 'component', 'performance']),
            filePath: z.string().nullable().describe('File path to modify, if known'),
            priority: z.enum(['high', 'medium', 'low']),
          }),
          execute: async ({ title, description, proposalType, filePath, priority }) => {
            return { title, description, proposalType, filePath, priority }
          },
        }),
      },
    })

    // Extract the proposal from tool calls
    let proposalData = null
    for (const step of analysisResult.steps) {
      for (const toolCall of step.toolCalls) {
        if (toolCall.toolName === 'createProposal') {
          proposalData = toolCall.args
          break
        }
      }
    }

    if (!proposalData) {
      // Fallback: create a generic proposal
      proposalData = {
        title: `Feedback: ${feedback.slice(0, 50)}...`,
        description: `User feedback from ${discordUsername}:\n\n${feedback}`,
        proposalType: 'content',
        filePath: null,
        priority: 'medium',
      }
    }

    // Create the proposal in the database
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({
        repository_id: repositoryId,
        title: proposalData.title,
        description: proposalData.description,
        proposal_type: proposalData.proposalType,
        file_path: proposalData.filePath,
        status: 'pending',
        discord_thread_id: params.channelId,
        feedback: [{ 
          from: discordUsername, 
          message: feedback, 
          priority: proposalData.priority,
          timestamp: new Date().toISOString() 
        }],
      })
      .select()
      .single()

    if (proposalError) {
      throw proposalError
    }

    // Update agent log
    await supabase
      .from('agent_logs')
      .update({
        status: 'completed',
        output_data: { proposalId: proposal.id, proposalData },
        proposal_id: proposal.id,
      })
      .eq('repository_id', repositoryId)
      .eq('action', 'analyze_feedback')
      .eq('status', 'running')

    // Send follow-up to Discord
    await sendDiscordFollowUp(applicationId, interactionToken, {
      content: `Created proposal based on your feedback!`,
      embeds: [{
        title: proposalData.title,
        description: proposalData.description,
        color: 0x00aaff,
        fields: [
          { name: 'Type', value: proposalData.proposalType, inline: true },
          { name: 'Priority', value: proposalData.priority, inline: true },
          { name: 'Proposal ID', value: `\`${proposal.id.slice(0, 8)}\``, inline: true },
        ],
        footer: { text: `Use /approve proposal_id:${proposal.id.slice(0, 8)} to approve` },
      }],
    })

    // Now trigger the implementation agent to generate the actual changes
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/agents/implement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId: proposal.id,
        repositoryId,
        interactionToken,
        applicationId,
      }),
    }).catch(err => console.error('Implementation trigger error:', err))

    return NextResponse.json({ success: true, proposalId: proposal.id })
  } catch (error) {
    console.error('Feedback agent error:', error)
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    )
  }
}
