import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { sendDiscordFollowUp } from '@/lib/discord'

export const maxDuration = 60

interface RequestParams {
  description: string
  requestType: string
  repositoryId: string
  discordUserId: string
  discordUsername: string
  channelId: string
  interactionToken: string
  applicationId: string
}

export async function POST(request: Request) {
  try {
    const params: RequestParams = await request.json()
    const { description, requestType, repositoryId, discordUsername, interactionToken, applicationId } = params

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

    // Log agent activity
    await supabase.from('agent_logs').insert({
      user_id: repository.user_id,
      repository_id: repositoryId,
      agent_type: 'researcher',
      action: 'plan_request',
      status: 'running',
      input_data: { description, requestType, discordUsername },
    })

    // Use AI to plan the implementation
    const planResult = await generateText({
      model: 'anthropic/claude-sonnet-4-20250514',
      system: `You are an expert web developer and SEO specialist. Plan the implementation of a feature request.

Repository: ${repository.full_name}
Request Type: ${requestType}

Create a detailed implementation plan that includes:
1. What needs to be built
2. Which files need to be created or modified
3. Key implementation details
4. SEO considerations if applicable

Be specific and actionable.`,
      prompt: `Plan this ${requestType} request from ${discordUsername}:\n\n"${description}"`,
      tools: {
        createImplementationPlan: tool({
          description: 'Create an implementation plan',
          inputSchema: z.object({
            title: z.string().describe('Clear title for this feature/change'),
            summary: z.string().describe('Brief summary of what will be built'),
            implementationDetails: z.string().describe('Detailed implementation plan'),
            filesToCreate: z.array(z.string()).describe('New files to create'),
            filesToModify: z.array(z.string()).describe('Existing files to modify'),
            estimatedComplexity: z.enum(['simple', 'moderate', 'complex']),
            seoConsiderations: z.string().nullable().describe('SEO-related notes'),
          }),
          execute: async (plan) => plan,
        }),
      },
    })

    // Extract the plan from tool calls
    let planData = null
    for (const step of planResult.steps) {
      for (const toolCall of step.toolCalls) {
        if (toolCall.toolName === 'createImplementationPlan') {
          planData = toolCall.args
          break
        }
      }
    }

    if (!planData) {
      planData = {
        title: `Request: ${description.slice(0, 50)}...`,
        summary: description,
        implementationDetails: `Implement: ${description}`,
        filesToCreate: [],
        filesToModify: [],
        estimatedComplexity: 'moderate',
        seoConsiderations: null,
      }
    }

    // Create the proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({
        repository_id: repositoryId,
        title: planData.title,
        description: `${planData.summary}\n\n**Implementation Plan:**\n${planData.implementationDetails}${planData.seoConsiderations ? `\n\n**SEO Notes:** ${planData.seoConsiderations}` : ''}`,
        proposal_type: requestType === 'seo' ? 'seo_meta' : 'component',
        status: 'pending',
        discord_thread_id: params.channelId,
        feedback: [{
          from: discordUsername,
          message: description,
          type: 'request',
          complexity: planData.estimatedComplexity,
          files: {
            create: planData.filesToCreate,
            modify: planData.filesToModify,
          },
          timestamp: new Date().toISOString(),
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
        output_data: { proposalId: proposal.id, planData },
        proposal_id: proposal.id,
      })
      .eq('repository_id', repositoryId)
      .eq('action', 'plan_request')
      .eq('status', 'running')

    // Build the files list for display
    const filesList = [
      ...planData.filesToCreate.map((f: string) => `+ ${f}`),
      ...planData.filesToModify.map((f: string) => `~ ${f}`),
    ].join('\n') || 'To be determined'

    // Send follow-up to Discord
    await sendDiscordFollowUp(applicationId, interactionToken, {
      content: `Created implementation plan for your request!`,
      embeds: [{
        title: planData.title,
        description: planData.summary,
        color: 0x44ff44,
        fields: [
          { name: 'Complexity', value: planData.estimatedComplexity, inline: true },
          { name: 'Type', value: requestType, inline: true },
          { name: 'Proposal ID', value: `\`${proposal.id.slice(0, 8)}\``, inline: true },
          { name: 'Files', value: `\`\`\`diff\n${filesList}\n\`\`\``, inline: false },
        ],
        footer: { text: `Use /approve proposal_id:${proposal.id.slice(0, 8)} to start implementation` },
      }],
    })

    return NextResponse.json({ success: true, proposalId: proposal.id })
  } catch (error) {
    console.error('Request agent error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
