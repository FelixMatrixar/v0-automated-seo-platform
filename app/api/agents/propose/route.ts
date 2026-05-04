import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { sendDiscordFollowUp } from '@/lib/discord'
import { 
  createBranch, 
  commitFile, 
  createPullRequest,
  getFileContent 
} from '@/lib/github'

// Schema for the AI-generated implementation
const ImplementationSchema = z.object({
  title: z.string().describe('Short title for the proposal'),
  description: z.string().describe('Detailed description of what changes are being made'),
  filePath: z.string().describe('The file path to modify (e.g., app/page.tsx, components/hero.tsx)'),
  newContent: z.string().describe('The complete new file content'),
  commitMessage: z.string().describe('Git commit message'),
})

export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const {
      change,
      repositoryId,
      userId,
      discordUserId,
      discordUsername,
      channelId,
      interactionToken,
      applicationId,
    } = await request.json()

    const supabase = await createClient()

    // Get repository and user details
    const { data: repository } = await supabase
      .from('repositories')
      .select('*, profile:profiles(*)')
      .eq('id', repositoryId)
      .single()

    if (!repository) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: 'Repository not found. Please check your settings.',
      })
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    const githubToken = repository.profile?.github_access_token
    if (!githubToken) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: 'GitHub access token not found. Please reconnect your GitHub account.',
      })
      return NextResponse.json({ error: 'No GitHub token' }, { status: 401 })
    }

    // Notify Discord that we're analyzing
    await sendDiscordFollowUp(applicationId, interactionToken, {
      content: `Analyzing request and planning implementation...`,
    })

    // Get repository structure to understand context
    let repoContext = ''
    try {
      // Try to get key files for context
      const layoutContent = await getFileContent(
        githubToken,
        repository.full_name,
        'app/layout.tsx'
      )
      const pageContent = await getFileContent(
        githubToken,
        repository.full_name,
        'app/page.tsx'
      )
      
      repoContext = `
Current app/layout.tsx:
\`\`\`tsx
${layoutContent?.slice(0, 2000) || 'Not found'}
\`\`\`

Current app/page.tsx:
\`\`\`tsx
${pageContent?.slice(0, 3000) || 'Not found'}
\`\`\`
`
    } catch {
      repoContext = 'Could not fetch repository files for context.'
    }

    // Use AI to plan and generate the implementation
    const result = await generateText({
      model: 'google/gemini-2.5-flash-lite',
      output: Output.object({ schema: ImplementationSchema }),
      prompt: `You are an expert React/Next.js developer. A stakeholder has requested the following change:

"${change}"

Repository: ${repository.full_name}

${repoContext}

Generate an implementation for this request. You should:
1. Create a clear title for the proposal
2. Write a detailed description explaining the changes
3. Specify which file to modify (create new files in components/ if needed)
4. Generate the complete new file content using React, TypeScript, and Tailwind CSS
5. Write a clear commit message

Guidelines:
- Use Next.js App Router patterns
- Use Tailwind CSS for styling
- Make the component responsive
- Follow accessibility best practices
- If creating a new component, make sure to export it properly

Return the implementation details as a JSON object.`,
    })

    const implementation = result.output

    if (!implementation) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: 'Failed to generate implementation. Please try rephrasing your request.',
      })
      return NextResponse.json({ error: 'AI failed to generate implementation' }, { status: 500 })
    }

    // Notify that we're implementing
    await sendDiscordFollowUp(applicationId, interactionToken, {
      content: `Implementation planned!\n\n**${implementation.title}**\n${implementation.description}\n\nCreating branch and committing changes...`,
    })

    // Create a branch
    const branchName = `seo-agent/${Date.now()}-${change.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
    
    const branchResult = await createBranch(
      githubToken,
      repository.full_name,
      branchName,
      repository.default_branch || 'main'
    )

    if (!branchResult.success) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: `Failed to create branch: ${branchResult.error}`,
      })
      return NextResponse.json({ error: branchResult.error }, { status: 500 })
    }

    // Commit the changes
    const commitResult = await commitFile(
      githubToken,
      repository.full_name,
      branchName,
      implementation.filePath,
      implementation.newContent,
      implementation.commitMessage
    )

    if (!commitResult.success) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: `Failed to commit changes: ${commitResult.error}`,
      })
      return NextResponse.json({ error: commitResult.error }, { status: 500 })
    }

    // Create pull request
    const prResult = await createPullRequest(
      githubToken,
      repository.full_name,
      branchName,
      repository.default_branch || 'main',
      implementation.title,
      `## Summary\n${implementation.description}\n\n## Changes\n- Modified \`${implementation.filePath}\`\n\n## Requested by\n@${discordUsername} via Discord\n\n---\n*Generated by SEO Agent*`
    )

    if (!prResult.success) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: `Failed to create pull request: ${prResult.error}`,
      })
      return NextResponse.json({ error: prResult.error }, { status: 500 })
    }

    // Save proposal to database
    const { data: proposal } = await supabase
      .from('proposals')
      .insert({
        repository_id: repositoryId,
        title: implementation.title,
        description: implementation.description,
        proposal_type: 'component',
        file_path: implementation.filePath,
        proposed_content: implementation.newContent,
        branch_name: branchName,
        pr_number: prResult.prNumber,
        pr_url: prResult.prUrl,
        status: 'pending',
        discord_message_id: channelId,
      })
      .select()
      .single()

    // Log agent activity
    await supabase.from('agent_logs').insert({
      user_id: userId,
      repository_id: repositoryId,
      proposal_id: proposal?.id,
      agent_type: 'implementation',
      action: `Implemented: ${implementation.title}`,
      status: 'completed',
      input_data: { change, discordUsername },
      output_data: { 
        branchName, 
        prUrl: prResult.prUrl,
        filePath: implementation.filePath,
      },
      duration_ms: Date.now() - startTime,
    })

    // Send final Discord message with PR link
    await sendDiscordFollowUp(applicationId, interactionToken, {
      embeds: [{
        title: `Pull Request Created: ${implementation.title}`,
        description: implementation.description,
        color: 0x00aaff,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'Branch', value: branchName, inline: true },
          { name: 'File', value: implementation.filePath, inline: true },
          { name: 'Pull Request', value: prResult.prUrl || 'N/A', inline: false },
        ],
        footer: { text: `Proposal ID: ${proposal?.id?.slice(0, 8) || 'N/A'}` },
        timestamp: new Date().toISOString(),
      }],
      content: `**Your change is ready for review!**\n\nUse these commands:\n- \`/approve proposal_id:${proposal?.id?.slice(0, 8)}\` - Approve and deploy\n- \`/reject proposal_id:${proposal?.id?.slice(0, 8)}\` - Reject the change`,
    })

    return NextResponse.json({
      success: true,
      proposal,
      prUrl: prResult.prUrl,
      duration: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Propose pipeline error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
