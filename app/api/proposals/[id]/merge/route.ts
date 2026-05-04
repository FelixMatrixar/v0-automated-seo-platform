import { createClient } from '@/lib/supabase/server'
import { createOctokit, mergePullRequest } from '@/lib/github'
import { sendProposalNotification } from '@/lib/discord'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get profile with GitHub token
  const { data: profile } = await supabase
    .from('profiles')
    .select('github_access_token')
    .eq('id', user.id)
    .single()

  if (!profile?.github_access_token) {
    return NextResponse.json(
      { error: 'GitHub access token not found' },
      { status: 400 }
    )
  }

  // Get the proposal
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(`
      *,
      repository:repositories(
        full_name,
        user_id
      )
    `)
    .eq('id', id)
    .single()

  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Verify ownership
  if (proposal.repository.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (proposal.status !== 'approved' && proposal.status !== 'deployed') {
    return NextResponse.json(
      { error: 'Proposal must be approved or deployed to merge' },
      { status: 400 }
    )
  }

  if (!proposal.pr_number) {
    return NextResponse.json(
      { error: 'Proposal has no associated pull request' },
      { status: 400 }
    )
  }

  const octokit = createOctokit(profile.github_access_token)
  const [owner, repo] = proposal.repository.full_name.split('/')

  try {
    // Merge the pull request
    const merged = await mergePullRequest(
      octokit,
      owner,
      repo,
      proposal.pr_number,
      `[SEO] ${proposal.title}`
    )

    if (!merged) {
      return NextResponse.json(
        { error: 'Failed to merge pull request' },
        { status: 500 }
      )
    }

    // Update the proposal status
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'merged',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating proposal:', updateError)
    }

    // Log the merge
    await supabase.from('agent_logs').insert({
      user_id: user.id,
      repository_id: proposal.repository_id,
      proposal_id: proposal.id,
      agent_type: 'implementation',
      action: 'merge_proposal',
      status: 'completed',
      output_data: {
        pr_number: proposal.pr_number,
      },
    })

    // Notify Discord
    try {
      await sendProposalNotification({
        ...proposal,
        status: 'merged',
      }, proposal.repository.full_name)
    } catch (discordError) {
      console.error('Error sending Discord notification:', discordError)
    }

    return NextResponse.json({
      success: true,
      message: 'Pull request merged successfully',
    })
  } catch (error) {
    console.error('Error merging proposal:', error)

    return NextResponse.json(
      { error: 'Failed to merge pull request' },
      { status: 500 }
    )
  }
}
