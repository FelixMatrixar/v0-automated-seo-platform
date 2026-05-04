import { createClient } from '@/lib/supabase/server'
import { createOctokit, closePullRequest } from '@/lib/github'
import { sendProposalNotification } from '@/lib/discord'
import { NextResponse } from 'next/server'

// GET - Fetch a single proposal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  return NextResponse.json(proposal)
}

// PATCH - Update proposal status (approve/reject)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { status, feedback } = body

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Get profile with GitHub token
  const { data: profile } = await supabase
    .from('profiles')
    .select('github_access_token')
    .eq('id', user.id)
    .single()

  // Get the proposal
  const { data: proposal, error: fetchError } = await supabase
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

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Verify ownership
  if (proposal.repository.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // If rejecting and there's an open PR, close it
  if (status === 'rejected' && proposal.pr_number && profile?.github_access_token) {
    const octokit = createOctokit(profile.github_access_token)
    const [owner, repo] = proposal.repository.full_name.split('/')

    await closePullRequest(octokit, owner, repo, proposal.pr_number)
  }

  // Update the proposal
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (feedback) {
    const existingFeedback = Array.isArray(proposal.feedback) ? proposal.feedback : []
    updateData.feedback = [...existingFeedback, {
      user_id: user.id,
      action: status,
      comment: feedback,
      created_at: new Date().toISOString(),
    }]
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update(updateData)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }

  // Log the action
  await supabase.from('agent_logs').insert({
    user_id: user.id,
    repository_id: proposal.repository_id,
    proposal_id: proposal.id,
    agent_type: 'facilitator',
    action: `proposal_${status}`,
    status: 'completed',
    input_data: { feedback },
  })

  // Notify Discord
  try {
    await sendProposalNotification({
      ...proposal,
      status,
    }, proposal.repository.full_name)
  } catch (discordError) {
    console.error('Error sending Discord notification:', discordError)
  }

  return NextResponse.json({ success: true, status })
}

// DELETE - Delete a proposal
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the proposal to verify ownership
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select(`
      repository:repositories(user_id)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Verify ownership
  if (proposal.repository.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
