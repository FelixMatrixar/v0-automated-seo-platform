import { createClient } from '@/lib/supabase/server'
import { createOctokit, createBranch, commitFile, createPullRequest } from '@/lib/github'
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
        default_branch,
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

  if (!proposal.proposed_content || !proposal.file_path) {
    return NextResponse.json(
      { error: 'Proposal has no content to deploy' },
      { status: 400 }
    )
  }

  const octokit = createOctokit(profile.github_access_token)
  const [owner, repo] = proposal.repository.full_name.split('/')
  const branchName = `seo-improvement/${proposal.id.slice(0, 8)}`

  try {
    // Create a new branch
    const branchCreated = await createBranch(
      octokit,
      owner,
      repo,
      branchName,
      proposal.repository.default_branch
    )

    if (!branchCreated) {
      return NextResponse.json(
        { error: 'Failed to create branch' },
        { status: 500 }
      )
    }

    // Commit the changes
    const commitResult = await commitFile(
      octokit,
      owner,
      repo,
      branchName,
      proposal.file_path,
      proposal.proposed_content,
      `SEO improvement: ${proposal.title}\n\nProposal ID: ${proposal.id}`
    )

    if (!commitResult) {
      return NextResponse.json(
        { error: 'Failed to commit changes' },
        { status: 500 }
      )
    }

    // Create a pull request
    const prBody = `## SEO Improvement Proposal

**Title:** ${proposal.title}

**Description:** ${proposal.description || 'No description provided'}

**Type:** ${proposal.proposal_type}

**File:** \`${proposal.file_path}\`

---

This PR was automatically created by the SEO Agent Platform.

### Changes
\`\`\`diff
${generateDiff(proposal.original_content || '', proposal.proposed_content)}
\`\`\`

---
Proposal ID: \`${proposal.id}\`
`

    const pr = await createPullRequest(
      octokit,
      owner,
      repo,
      `[SEO] ${proposal.title}`,
      prBody,
      branchName,
      proposal.repository.default_branch
    )

    if (!pr) {
      return NextResponse.json(
        { error: 'Failed to create pull request' },
        { status: 500 }
      )
    }

    // Generate preview URL (Vercel preview deployment pattern)
    const previewUrl = `https://${repo}-git-${branchName.replace(/\//g, '-')}-${owner.toLowerCase()}.vercel.app`

    // Update the proposal with PR info
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'deployed',
        branch_name: branchName,
        pr_number: pr.number,
        pr_url: pr.url,
        preview_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating proposal:', updateError)
    }

    // Log the deployment
    await supabase.from('agent_logs').insert({
      user_id: user.id,
      repository_id: proposal.repository_id,
      proposal_id: proposal.id,
      agent_type: 'implementation',
      action: 'deploy_proposal',
      status: 'completed',
      output_data: {
        branch_name: branchName,
        pr_number: pr.number,
        pr_url: pr.url,
        preview_url: previewUrl,
      },
    })

    // Notify Discord if configured
    try {
      await sendProposalNotification({
        ...proposal,
        status: 'deployed',
        pr_number: pr.number,
        pr_url: pr.url,
        preview_url: previewUrl,
      }, proposal.repository.full_name)
    } catch (discordError) {
      console.error('Error sending Discord notification:', discordError)
    }

    return NextResponse.json({
      success: true,
      branch_name: branchName,
      pr_number: pr.number,
      pr_url: pr.url,
      preview_url: previewUrl,
    })
  } catch (error) {
    console.error('Error deploying proposal:', error)

    // Log the failure
    await supabase.from('agent_logs').insert({
      user_id: user.id,
      repository_id: proposal.repository_id,
      proposal_id: proposal.id,
      agent_type: 'implementation',
      action: 'deploy_proposal',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to deploy proposal' },
      { status: 500 }
    )
  }
}

function generateDiff(original: string, proposed: string): string {
  const originalLines = original.split('\n')
  const proposedLines = proposed.split('\n')
  const diff: string[] = []

  const maxLines = Math.max(originalLines.length, proposedLines.length)

  for (let i = 0; i < Math.min(maxLines, 50); i++) {
    const originalLine = originalLines[i] || ''
    const proposedLine = proposedLines[i] || ''

    if (originalLine !== proposedLine) {
      if (originalLine) {
        diff.push(`- ${originalLine}`)
      }
      if (proposedLine) {
        diff.push(`+ ${proposedLine}`)
      }
    } else if (originalLine) {
      diff.push(`  ${originalLine}`)
    }
  }

  if (maxLines > 50) {
    diff.push(`\n... and ${maxLines - 50} more lines`)
  }

  return diff.join('\n')
}
