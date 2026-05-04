import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  InteractionType,
  InteractionResponseType,
  verifyDiscordRequest,
  createStatusUpdateEmbed,
  sendDiscordWebhook,
  type DiscordInteraction,
} from '@/lib/discord'

export async function POST(request: Request) {
  try {
    // Get headers for verification
    const signature = request.headers.get('x-signature-ed25519') || ''
    const timestamp = request.headers.get('x-signature-timestamp') || ''
    const body = await request.text()

    // Verify the request (use environment variable for public key)
    const publicKey = process.env.DISCORD_PUBLIC_KEY || ''
    if (!verifyDiscordRequest(signature, timestamp, body, publicKey)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const interaction: DiscordInteraction = JSON.parse(body)

    // Handle PING
    if (interaction.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG })
    }

    // Handle slash commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = interaction.data?.name
      const options = interaction.data?.options || []
      const user = interaction.member?.user || interaction.user

      const supabase = await createClient()

      if (commandName === 'seo') {
        const subCommand = options[0]?.name
        const proposalId = options[0]?.value || options.find(o => o.name === 'proposal_id')?.value

        if (!proposalId) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Please provide a proposal ID.',
              flags: 64, // Ephemeral
            },
          })
        }

        // Get the proposal
        const { data: proposal, error } = await supabase
          .from('proposals')
          .select('*, repository:repositories(full_name, user_id)')
          .eq('id', proposalId)
          .single()

        if (error || !proposal) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Proposal \`${proposalId}\` not found.`,
              flags: 64,
            },
          })
        }

        switch (subCommand) {
          case 'deploy':
            // Update status to approved
            await supabase
              .from('proposals')
              .update({ status: 'approved' })
              .eq('id', proposalId)

            // Log the feedback
            await supabase.from('discord_feedback').insert({
              proposal_id: proposalId,
              discord_user_id: user?.id || 'unknown',
              discord_username: user?.username || 'Unknown',
              action: 'approve',
            })

            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Proposal \`${proposalId}\` has been approved for deployment.`,
                embeds: [createStatusUpdateEmbed(proposalId, 'approved', user?.username)],
              },
            })

          case 'reject':
            const reason = options.find(o => o.name === 'reason')?.value || ''

            await supabase
              .from('proposals')
              .update({ status: 'rejected' })
              .eq('id', proposalId)

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
                content: `Proposal \`${proposalId}\` has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
                embeds: [createStatusUpdateEmbed(proposalId, 'rejected', user?.username)],
              },
            })

          case 'status':
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `**Proposal Status**\nID: \`${proposalId}\`\nTitle: ${proposal.title}\nStatus: **${proposal.status.toUpperCase()}**\nType: ${proposal.proposal_type}\nRepository: ${(proposal.repository as { full_name: string })?.full_name || 'Unknown'}`,
                flags: 64,
              },
            })

          case 'merge':
            if (proposal.status !== 'approved' && proposal.status !== 'deployed') {
              return NextResponse.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: `Cannot merge proposal \`${proposalId}\`. Current status: ${proposal.status}. Proposal must be approved or deployed first.`,
                  flags: 64,
                },
              })
            }

            await supabase
              .from('proposals')
              .update({ status: 'merged' })
              .eq('id', proposalId)

            await supabase.from('discord_feedback').insert({
              proposal_id: proposalId,
              discord_user_id: user?.id || 'unknown',
              discord_username: user?.username || 'Unknown',
              action: 'approve',
              comment: 'Merged to production',
            })

            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Proposal \`${proposalId}\` has been merged to production!`,
                embeds: [createStatusUpdateEmbed(proposalId, 'merged', user?.username)],
              },
            })

          default:
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: 'Unknown command. Available commands: deploy, reject, status, merge',
                flags: 64,
              },
            })
        }
      }
    }

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Command not recognized.',
        flags: 64,
      },
    })
  } catch (error) {
    console.error('Discord webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
