import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { z } from 'zod'

// Facilitator Agent - Handles Discord communication and approval workflows
export const facilitatorAgent = new ToolLoopAgent({
  model: 'openai/gpt-5',
  instructions: `You are a facilitator agent responsible for communication and workflow management. Your role is to:

1. Create clear, concise Discord messages about SEO proposals
2. Format technical information for non-technical stakeholders
3. Process feedback and update proposal statuses
4. Coordinate between the research and implementation phases
5. Summarize changes and their expected impact

Communication style:
- Be professional but approachable
- Use clear, jargon-free language when possible
- Include relevant context and next steps
- Format messages for Discord (markdown, embeds)
- Highlight the business value of changes`,

  tools: {
    formatProposalMessage: tool({
      description: 'Format a proposal into a Discord message',
      inputSchema: z.object({
        proposalId: z.string(),
        title: z.string(),
        description: z.string(),
        proposalType: z.string(),
        filePath: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        estimatedImpact: z.string(),
        previewUrl: z.string().optional(),
      }),
      execute: async ({ proposalId, title, description, proposalType, filePath, priority, estimatedImpact, previewUrl }) => {
        const priorityEmoji = {
          high: ':red_circle:',
          medium: ':orange_circle:',
          low: ':green_circle:',
        }[priority]

        const typeLabels: Record<string, string> = {
          seo_meta: 'SEO Metadata',
          content: 'Content Update',
          component: 'Component Change',
          performance: 'Performance Fix',
        }

        const embed = {
          title: `New SEO Proposal: ${title}`,
          description,
          color: priority === 'high' ? 0xff4444 : priority === 'medium' ? 0xffaa00 : 0x44ff44,
          fields: [
            { name: 'Type', value: typeLabels[proposalType] || proposalType, inline: true },
            { name: 'Priority', value: `${priorityEmoji} ${priority.toUpperCase()}`, inline: true },
            { name: 'File', value: `\`${filePath}\``, inline: false },
            { name: 'Expected Impact', value: estimatedImpact, inline: false },
          ],
          footer: {
            text: `Proposal ID: ${proposalId}`,
          },
        }

        if (previewUrl) {
          embed.fields.push({
            name: 'Preview',
            value: `[View Preview](${previewUrl})`,
            inline: true,
          })
        }

        const actions = `
**Actions:**
• \`/seo deploy ${proposalId}\` - Approve and deploy
• \`/seo reject ${proposalId}\` - Reject with feedback
• \`/seo status ${proposalId}\` - Check status`

        return {
          embed,
          content: actions,
          proposalId,
        }
      },
    }),

    formatStatusUpdate: tool({
      description: 'Format a status update message for Discord',
      inputSchema: z.object({
        proposalId: z.string(),
        previousStatus: z.string(),
        newStatus: z.string(),
        updatedBy: z.string().optional(),
        details: z.string().optional(),
      }),
      execute: async ({ proposalId, previousStatus, newStatus, updatedBy, details }) => {
        const statusEmojis: Record<string, string> = {
          pending: ':hourglass:',
          approved: ':white_check_mark:',
          rejected: ':x:',
          deployed: ':rocket:',
          merged: ':tada:',
        }

        const message = `${statusEmojis[newStatus] || ':arrow_right:'} **Status Update**
Proposal \`${proposalId}\` changed from **${previousStatus}** to **${newStatus}**
${updatedBy ? `Updated by: ${updatedBy}` : ''}
${details ? `\n${details}` : ''}`

        return { message, proposalId, newStatus }
      },
    }),

    formatDeploymentNotification: tool({
      description: 'Create a deployment notification message',
      inputSchema: z.object({
        proposalId: z.string(),
        title: z.string(),
        previewUrl: z.string(),
        prUrl: z.string(),
        branchName: z.string(),
      }),
      execute: async ({ proposalId, title, previewUrl, prUrl, branchName }) => {
        const embed = {
          title: ':rocket: Deployment Ready',
          description: `The proposal "${title}" has been deployed to preview.`,
          color: 0x00ff88,
          fields: [
            { name: 'Preview URL', value: `[Open Preview](${previewUrl})`, inline: true },
            { name: 'Pull Request', value: `[View PR](${prUrl})`, inline: true },
            { name: 'Branch', value: `\`${branchName}\``, inline: true },
          ],
          footer: {
            text: `Proposal ID: ${proposalId}`,
          },
        }

        const content = `
**Next Steps:**
• Review the preview deployment
• \`/seo merge ${proposalId}\` to merge to production
• \`/seo reject ${proposalId}\` to close without merging`

        return { embed, content, proposalId }
      },
    }),

    processDiscordFeedback: tool({
      description: 'Process feedback from Discord and update proposal',
      inputSchema: z.object({
        proposalId: z.string(),
        action: z.enum(['approve', 'reject', 'comment', 'request_changes']),
        discordUserId: z.string(),
        discordUsername: z.string(),
        comment: z.string().optional(),
      }),
      execute: async ({ proposalId, action, discordUserId, discordUsername, comment }) => {
        const actionMessages: Record<string, string> = {
          approve: `Approved by ${discordUsername}`,
          reject: `Rejected by ${discordUsername}${comment ? `: ${comment}` : ''}`,
          comment: `Comment from ${discordUsername}: ${comment}`,
          request_changes: `Changes requested by ${discordUsername}: ${comment}`,
        }

        return {
          proposalId,
          action,
          discordUserId,
          discordUsername,
          comment,
          message: actionMessages[action],
          timestamp: new Date().toISOString(),
        }
      },
    }),

    summarizeProposalBatch: tool({
      description: 'Create a summary of multiple proposals',
      inputSchema: z.object({
        proposals: z.array(z.object({
          id: z.string(),
          title: z.string(),
          status: z.string(),
          proposalType: z.string(),
        })),
        repositoryName: z.string(),
      }),
      execute: async ({ proposals, repositoryName }) => {
        const statusCounts = proposals.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const typeCounts = proposals.reduce((acc, p) => {
          acc[p.proposalType] = (acc[p.proposalType] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const embed = {
          title: `:clipboard: SEO Proposals Summary`,
          description: `Repository: **${repositoryName}**\nTotal proposals: **${proposals.length}**`,
          color: 0x5865f2,
          fields: [
            {
              name: 'By Status',
              value: Object.entries(statusCounts)
                .map(([status, count]) => `${status}: ${count}`)
                .join('\n'),
              inline: true,
            },
            {
              name: 'By Type',
              value: Object.entries(typeCounts)
                .map(([type, count]) => `${type}: ${count}`)
                .join('\n'),
              inline: true,
            },
          ],
        }

        return { embed, proposalCount: proposals.length, statusCounts, typeCounts }
      },
    }),

    createThreadForProposal: tool({
      description: 'Create a discussion thread for a proposal',
      inputSchema: z.object({
        proposalId: z.string(),
        title: z.string(),
        initialMessage: z.string(),
      }),
      execute: async ({ proposalId, title, initialMessage }) => {
        return {
          threadName: `SEO Proposal: ${title}`,
          initialMessage,
          proposalId,
          status: 'thread_created',
        }
      },
    }),
  },

  stopWhen: stepCountIs(8),

  callOptionsSchema: z.object({
    proposalId: z.string().optional(),
    userId: z.string(),
    discordWebhookUrl: z.string().optional(),
  }),

  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: settings.instructions + `
    
Facilitation context:
- Proposal ID: ${options.proposalId || 'N/A'}
- User ID: ${options.userId}
- Format messages appropriately for Discord.`,
  }),
})

export type FacilitatorAgent = typeof facilitatorAgent
