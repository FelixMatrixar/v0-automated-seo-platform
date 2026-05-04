import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  InteractionType,
  InteractionResponseType,
  verifyDiscordRequest,
  createStatusUpdateEmbed,
  type DiscordInteraction,
} from '@/lib/discord'

export async function POST(request: Request) {
  try {
    // Get headers for verification
    const signature = request.headers.get('x-signature-ed25519') || ''
    const timestamp = request.headers.get('x-signature-timestamp') || ''
    const body = await request.text()

    // Verify the request
    const publicKey = process.env.DISCORD_PUBLIC_KEY || ''
    if (!verifyDiscordRequest(signature, timestamp, body, publicKey)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const interaction: DiscordInteraction = JSON.parse(body)

    // Handle PING (required for Discord to verify endpoint)
    if (interaction.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG })
    }

    // Handle slash commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = interaction.data?.name
      const options = interaction.data?.options || []
      const user = interaction.member?.user || interaction.user
      const channelId = interaction.channel_id

      const supabase = await createClient()

      // ============================================
      // /propose <change> - Propose a change (main command for stakeholders)
      // ============================================
      if (commandName === 'propose' || commandName === 'feedback') {
        const changeDescription = options.find(o => o.name === 'change')?.value as string 
          || options.find(o => o.name === 'message')?.value as string
        const repoName = options.find(o => o.name === 'repo')?.value as string

        if (!changeDescription) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Please describe your proposed change.\n\nUsage: `/propose change:"Add a testimonials section to the homepage"`',
              flags: 64,
            },
          })
        }

        // Find user by their linked Discord User ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, default_repository_id, github_access_token, repositories(*)')
          .eq('discord_user_id', user?.id)
          .single()

        if (!profile) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Your Discord account is not linked. Please go to the SEO Agent dashboard and link your Discord account in Settings.\n\n**How to link:**\n1. Log into the SEO Agent dashboard\n2. Go to Settings\n3. Click "Link Discord Account"\n4. Enter your Discord User ID: \`${user?.id}\``,
              flags: 64,
            },
          })
        }

        // Get repository - use specified repo, default repo, or first available
        let repository = null
        const repos = profile.repositories as Array<{ full_name: string; id: string }> | null
        
        if (repoName && repos) {
          repository = repos.find(r => r.full_name.toLowerCase().includes(repoName.toLowerCase()))
        } else if (profile.default_repository_id && repos) {
          repository = repos.find(r => r.id === profile.default_repository_id)
        } else if (repos?.length) {
          repository = repos[0]
        }

        if (!repository) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'No repository found. Please connect a repository in the SEO Agent dashboard first.',
              flags: 64,
            },
          })
        }

        // Acknowledge immediately (Discord requires response within 3 seconds)
        const processingResponse = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `**New Proposal from ${user?.username}**\n\n> ${changeDescription}\n\n**Repository:** ${repository.full_name}\n\nThe AI is analyzing your request and will:\n1. Plan the implementation\n2. Generate the code changes\n3. Create a pull request\n4. Deploy a preview\n\nI'll post the preview URL here when ready...`,
          },
        }

        // Trigger the AI pipeline asynchronously
        triggerProposePipeline({
          change: changeDescription,
          repositoryId: repository.id,
          userId: profile.id,
          discordUserId: user?.id || 'unknown',
          discordUsername: user?.username || 'Unknown',
          channelId: channelId || '',
          interactionToken: interaction.token,
          applicationId: interaction.application_id,
        }).catch(err => console.error('Propose pipeline error:', err))

        return NextResponse.json(processingResponse)
      }

      // ============================================
      // /request <description> - Request a new feature/change
      // ============================================
      if (commandName === 'request') {
        const requestDescription = options.find(o => o.name === 'description')?.value as string
        const requestType = (options.find(o => o.name === 'type')?.value as string) || 'component'
        const repoName = options.find(o => o.name === 'repo')?.value as string

        if (!requestDescription) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Please provide a description. Usage: `/request description:"Add testimonials section"`',
              flags: 64,
            },
          })
        }

        // Find linked repository
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, repositories(*)')
          .eq('discord_channel_id', channelId)
          .single()

        let repository = profile?.repositories?.[0]

        if (repoName && profile) {
          const repos = profile.repositories as Array<{ full_name: string; id: string }>
          repository = repos?.find(r => r.full_name.includes(repoName))
        }

        if (!repository) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'No repository linked to this channel. Please configure Discord in your SEO Agent dashboard.',
              flags: 64,
            },
          })
        }

        // Acknowledge and process async
        const processingResponse = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `New ${requestType} request from **${user?.username || 'Unknown'}**:\n\n> ${requestDescription}\n\nGenerating implementation for **${(repository as { full_name: string }).full_name}**...\n\nI'll create a proposal with preview URL shortly.`,
          },
        }

        triggerRequestPipeline({
          description: requestDescription,
          requestType,
          repositoryId: (repository as { id: string }).id,
          discordUserId: user?.id || 'unknown',
          discordUsername: user?.username || 'Unknown',
          channelId,
          interactionToken: interaction.token,
          applicationId: interaction.application_id,
        }).catch(err => console.error('Request pipeline error:', err))

        return NextResponse.json(processingResponse)
      }

      // ============================================
      // /approve <proposal_id> - Approve and deploy
      // ============================================
      if (commandName === 'approve') {
        const proposalId = options.find(o => o.name === 'proposal_id')?.value as string

        if (!proposalId) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Please provide a proposal ID.', flags: 64 },
          })
        }

        const { data: proposal, error } = await supabase
          .from('proposals')
          .select('*, repository:repositories(full_name, user_id)')
          .eq('id', proposalId)
          .single()

        if (error || !proposal) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Proposal \`${proposalId}\` not found.`, flags: 64 },
          })
        }

        // Update status
        await supabase.from('proposals').update({ status: 'approved' }).eq('id', proposalId)

        // Log feedback
        await supabase.from('discord_feedback').insert({
          proposal_id: proposalId,
          discord_user_id: user?.id || 'unknown',
          discord_username: user?.username || 'Unknown',
          action: 'approve',
        })

        // Trigger deployment
        triggerDeployment(proposalId, interaction.token, interaction.application_id)
          .catch(err => console.error('Deployment error:', err))

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Proposal approved by **${user?.username}**! Deploying to preview...`,
            embeds: [createStatusUpdateEmbed(proposalId, 'approved', user?.username)],
          },
        })
      }

      // ============================================
      // /reject <proposal_id> [reason] - Reject proposal
      // ============================================
      if (commandName === 'reject') {
        const proposalId = options.find(o => o.name === 'proposal_id')?.value as string
        const reason = options.find(o => o.name === 'reason')?.value as string

        if (!proposalId) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Please provide a proposal ID.', flags: 64 },
          })
        }

        const { data: proposal, error } = await supabase
          .from('proposals')
          .select('*')
          .eq('id', proposalId)
          .single()

        if (error || !proposal) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Proposal \`${proposalId}\` not found.`, flags: 64 },
          })
        }

        await supabase.from('proposals').update({ status: 'rejected' }).eq('id', proposalId)

        await supabase.from('discord_feedback').insert({
          proposal_id: proposalId,
          discord_user_id: user?.id || 'unknown',
          discord_username: user?.username || 'Unknown',
          action: 'reject',
          comment: reason,
        })

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Proposal rejected by **${user?.username}**.${reason ? `\n\n**Reason:** ${reason}` : ''}`,
            embeds: [createStatusUpdateEmbed(proposalId, 'rejected', user?.username)],
          },
        })
      }

      // ============================================
      // /ship <proposal_id> - Merge to production
      // ============================================
      if (commandName === 'ship') {
        const proposalId = options.find(o => o.name === 'proposal_id')?.value as string

        if (!proposalId) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Please provide a proposal ID.', flags: 64 },
          })
        }

        const { data: proposal, error } = await supabase
          .from('proposals')
          .select('*, repository:repositories(full_name, user_id)')
          .eq('id', proposalId)
          .single()

        if (error || !proposal) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Proposal \`${proposalId}\` not found.`, flags: 64 },
          })
        }

        if (proposal.status !== 'approved' && proposal.status !== 'deployed') {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Cannot ship proposal \`${proposalId}\`. Status is **${proposal.status}**. Must be approved or deployed first.`,
              flags: 64,
            },
          })
        }

        // Trigger merge
        triggerMerge(proposalId, interaction.token, interaction.application_id)
          .catch(err => console.error('Merge error:', err))

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Shipping to production! Merging PR for proposal \`${proposalId}\`...`,
            embeds: [createStatusUpdateEmbed(proposalId, 'merged', user?.username)],
          },
        })
      }

      // ============================================
      // /status [proposal_id] - Check proposal status
      // ============================================
      if (commandName === 'status') {
        const proposalId = options.find(o => o.name === 'proposal_id')?.value as string

        if (proposalId) {
          const { data: proposal, error } = await supabase
            .from('proposals')
            .select('*, repository:repositories(full_name)')
            .eq('id', proposalId)
            .single()

          if (error || !proposal) {
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: `Proposal \`${proposalId}\` not found.`, flags: 64 },
            })
          }

          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: [{
                title: proposal.title,
                description: proposal.description || 'No description',
                color: getStatusColor(proposal.status),
                fields: [
                  { name: 'Status', value: proposal.status.toUpperCase(), inline: true },
                  { name: 'Type', value: proposal.proposal_type, inline: true },
                  { name: 'Repository', value: (proposal.repository as { full_name: string })?.full_name || 'Unknown', inline: true },
                  ...(proposal.preview_url ? [{ name: 'Preview', value: proposal.preview_url, inline: false }] : []),
                  ...(proposal.pr_url ? [{ name: 'Pull Request', value: proposal.pr_url, inline: false }] : []),
                ],
                footer: { text: `ID: ${proposal.id}` },
              }],
            },
          })
        }

        // No proposal ID - show recent proposals for this channel
        const { data: profile } = await supabase
          .from('profiles')
          .select('repositories(id)')
          .eq('discord_channel_id', channelId)
          .single()

        if (!profile?.repositories?.[0]) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'No repository linked to this channel.', flags: 64 },
          })
        }

        const repoIds = (profile.repositories as Array<{ id: string }>).map(r => r.id)
        const { data: proposals } = await supabase
          .from('proposals')
          .select('id, title, status, proposal_type')
          .in('repository_id', repoIds)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!proposals?.length) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'No proposals found.', flags: 64 },
          })
        }

        const proposalList = proposals.map(p => 
          `- **${p.title}** (${p.status}) - \`${p.id.slice(0, 8)}\``
        ).join('\n')

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `**Recent Proposals:**\n${proposalList}\n\nUse \`/status proposal_id:<id>\` for details.`,
          },
        })
      }
    }

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Unknown command.', flags: 64 },
    })
  } catch (error) {
    console.error('Discord webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Get status color
function getStatusColor(status: string): number {
  const colors: Record<string, number> = {
    pending: 0xffaa00,
    approved: 0x44ff44,
    rejected: 0xff4444,
    deployed: 0x00aaff,
    merged: 0x9944ff,
  }
  return colors[status] || 0x5865f2
}

// ============================================
// Async Pipeline Triggers
// ============================================

async function triggerProposePipeline(params: {
  change: string
  repositoryId: string
  userId: string
  discordUserId: string
  discordUsername: string
  channelId: string
  interactionToken: string
  applicationId: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  await fetch(`${baseUrl}/api/agents/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

async function triggerFeedbackPipeline(params: {
  feedback: string
  repositoryId: string
  discordUserId: string
  discordUsername: string
  channelId: string
  interactionToken: string
  applicationId: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  await fetch(`${baseUrl}/api/agents/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

async function triggerRequestPipeline(params: {
  description: string
  requestType: string
  repositoryId: string
  discordUserId: string
  discordUsername: string
  channelId: string
  interactionToken: string
  applicationId: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  await fetch(`${baseUrl}/api/agents/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

async function triggerDeployment(proposalId: string, token: string, appId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  await fetch(`${baseUrl}/api/proposals/${proposalId}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordToken: token, discordAppId: appId }),
  })
}

async function triggerMerge(proposalId: string, token: string, appId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  await fetch(`${baseUrl}/api/proposals/${proposalId}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordToken: token, discordAppId: appId }),
  })
}
