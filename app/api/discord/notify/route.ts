import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendDiscordWebhook,
  createProposalEmbed,
  createStatusUpdateEmbed,
  createDeploymentEmbed,
} from '@/lib/discord'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { proposal_id, notification_type, webhook_url } = body

    if (!proposal_id || !notification_type || !webhook_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('*, repository:repositories(full_name, seo_config)')
      .eq('id', proposal_id)
      .single()

    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      )
    }

    let embed
    let content = ''

    switch (notification_type) {
      case 'new_proposal':
        embed = createProposalEmbed({
          id: proposal.id,
          title: proposal.title,
          description: proposal.description,
          proposal_type: proposal.proposal_type,
          file_path: proposal.file_path,
          priority: 'medium',
        })
        content = `**Actions:**\n• \`/seo deploy ${proposal.id}\` - Approve and deploy\n• \`/seo reject ${proposal.id}\` - Reject with feedback`
        break

      case 'status_update':
        embed = createStatusUpdateEmbed(proposal.id, proposal.status)
        break

      case 'deployment_ready':
        embed = createDeploymentEmbed({
          id: proposal.id,
          title: proposal.title,
          preview_url: proposal.preview_url,
          pr_url: proposal.pr_url,
          branch_name: proposal.branch_name,
        })
        content = `**Next Steps:**\n• Review the preview deployment\n• \`/seo merge ${proposal.id}\` to merge to production`
        break

      default:
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        )
    }

    const result = await sendDiscordWebhook(webhook_url, {
      content,
      embeds: [embed],
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Discord notify error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
