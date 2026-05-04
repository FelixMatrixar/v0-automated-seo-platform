import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { sendDiscordFollowUp } from '@/lib/discord'
import { 
  createBranch, 
  commitFile, 
  createPullRequest,
  type GitHubClient 
} from '@/lib/github'
import { Octokit } from 'octokit'

export const maxDuration = 120

interface ImplementRequest {
  proposalId: string
  repositoryId: string
  interactionToken?: string
  applicationId?: string
}

export async function POST(request: Request) {
  try {
    const params: ImplementRequest = await request.json()
    const { proposalId, repositoryId, interactionToken, applicationId } = params

    const supabase = await createClient()

    // Get proposal and repository details
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('*, profile:profiles(github_access_token)')
      .eq('id', repositoryId)
      .single()

    if (repoError || !repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    const githubToken = (repository.profile as { github_access_token: string })?.github_access_token
    if (!githubToken) {
      if (applicationId && interactionToken) {
        await sendDiscordFollowUp(applicationId, interactionToken, {
          content: 'GitHub access token not found. Please reconnect your GitHub account.',
        })
      }
      return NextResponse.json({ error: 'GitHub token not found' }, { status: 401 })
    }

    // Log agent activity
    await supabase.from('agent_logs').insert({
      user_id: repository.user_id,
      repository_id: repositoryId,
      proposal_id: proposalId,
      agent_type: 'implementation',
      action: 'generate_code',
      status: 'running',
      input_data: { proposalId, title: proposal.title },
    })

    // Use AI to generate the implementation
    const implementationResult = await generateText({
      model: 'anthropic/claude-sonnet-4-20250514',
      system: `You are an expert React/Next.js developer. Generate production-ready code for the requested changes.

Repository: ${repository.full_name}
Proposal: ${proposal.title}
Type: ${proposal.proposal_type}

Guidelines:
- Use TypeScript
- Use Tailwind CSS for styling
- Follow Next.js App Router conventions
- Make code SEO-friendly with proper meta tags, semantic HTML
- Include proper accessibility attributes
- Keep components modular and reusable

Generate the complete file content that can be committed directly.`,
      prompt: `Generate code for this proposal:\n\nTitle: ${proposal.title}\n\nDescription: ${proposal.description}\n\nFile path hint: ${proposal.file_path || 'auto-determine based on proposal'}`,
      tools: {
        generateFile: tool({
          description: 'Generate a file to be committed',
          inputSchema: z.object({
            filePath: z.string().describe('Path relative to repo root (e.g., app/components/Hero.tsx)'),
            content: z.string().describe('Complete file content'),
            description: z.string().describe('Brief description of what this file does'),
          }),
          execute: async (file) => file,
        }),
      },
    })

    // Extract generated files
    const generatedFiles: Array<{ filePath: string; content: string; description: string }> = []
    for (const step of implementationResult.steps) {
      for (const toolCall of step.toolCalls) {
        if (toolCall.toolName === 'generateFile') {
          generatedFiles.push(toolCall.args as { filePath: string; content: string; description: string })
        }
      }
    }

    if (generatedFiles.length === 0) {
      // Fallback: Create a placeholder
      generatedFiles.push({
        filePath: proposal.file_path || `app/components/${proposal.title.replace(/\s+/g, '')}.tsx`,
        content: `// TODO: Implement ${proposal.title}\n// ${proposal.description}\n\nexport default function Component() {\n  return <div>TODO</div>\n}\n`,
        description: 'Placeholder component',
      })
    }

    // Create GitHub branch and commits
    const octokit = new Octokit({ auth: githubToken })
    const [owner, repo] = repository.full_name.split('/')
    const branchName = `seo-agent/${proposalId.slice(0, 8)}`

    const github: GitHubClient = { octokit, owner, repo }

    // Create branch
    await createBranch(github, branchName, repository.default_branch)

    // Commit each file
    for (const file of generatedFiles) {
      await commitFile(github, {
        branch: branchName,
        path: file.filePath,
        content: file.content,
        message: `feat: ${file.description}\n\nProposal: ${proposal.title}\nGenerated by SEO Agent`,
      })
    }

    // Create pull request
    const pr = await createPullRequest(github, {
      title: `[SEO Agent] ${proposal.title}`,
      body: `## ${proposal.title}\n\n${proposal.description}\n\n### Changes\n${generatedFiles.map(f => `- \`${f.filePath}\`: ${f.description}`).join('\n')}\n\n---\n*Generated by SEO Agent Platform*\n*Proposal ID: ${proposalId}*`,
      head: branchName,
      base: repository.default_branch,
    })

    // Update proposal with PR info
    await supabase
      .from('proposals')
      .update({
        branch_name: branchName,
        pr_number: pr.number,
        pr_url: pr.url,
        proposed_content: JSON.stringify(generatedFiles),
        status: 'deployed', // Mark as deployed (PR created)
      })
      .eq('id', proposalId)

    // Update agent log
    await supabase
      .from('agent_logs')
      .update({
        status: 'completed',
        output_data: { 
          branchName, 
          prNumber: pr.number, 
          prUrl: pr.url,
          filesGenerated: generatedFiles.map(f => f.filePath),
        },
      })
      .eq('proposal_id', proposalId)
      .eq('action', 'generate_code')
      .eq('status', 'running')

    // Notify Discord
    if (applicationId && interactionToken) {
      await sendDiscordFollowUp(applicationId, interactionToken, {
        content: `Implementation complete! Pull request created.`,
        embeds: [{
          title: `PR #${pr.number}: ${proposal.title}`,
          url: pr.url,
          description: `${generatedFiles.length} file(s) generated and committed.`,
          color: 0x9944ff,
          fields: [
            { name: 'Branch', value: `\`${branchName}\``, inline: true },
            { name: 'Files', value: generatedFiles.map(f => `\`${f.filePath}\``).join('\n'), inline: false },
          ],
          footer: { text: `Use /ship proposal_id:${proposalId.slice(0, 8)} to merge` },
        }],
      })
    }

    return NextResponse.json({ 
      success: true, 
      prNumber: pr.number, 
      prUrl: pr.url,
      branchName,
    })
  } catch (error) {
    console.error('Implementation agent error:', error)
    return NextResponse.json(
      { error: 'Failed to implement changes' },
      { status: 500 }
    )
  }
}
