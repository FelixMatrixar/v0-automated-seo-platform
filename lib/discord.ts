export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

export interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
  username?: string
  avatar_url?: string
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        username: payload.username || 'SEO Agent',
        avatar_url: payload.avatar_url || undefined,
      }),
    })

    // Discord returns 204 No Content on success
    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `Discord API error (${response.status}): ${text}` }
    }

    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export function createProposalEmbed(proposal: {
  id: string
  title: string
  description: string | null
  proposal_type: string
  file_path: string | null
  priority?: 'high' | 'medium' | 'low'
}): DiscordEmbed {
  const priorityColors = {
    high: 0xff4444,
    medium: 0xffaa00,
    low: 0x44ff44,
  }

  const typeLabels: Record<string, string> = {
    seo_meta: 'SEO Metadata',
    content: 'Content Update',
    component: 'Component Change',
    performance: 'Performance Fix',
  }

  return {
    title: `New SEO Proposal: ${proposal.title}`,
    description: proposal.description || 'No description provided',
    color: priorityColors[proposal.priority || 'medium'],
    fields: [
      {
        name: 'Type',
        value: typeLabels[proposal.proposal_type] || proposal.proposal_type,
        inline: true,
      },
      {
        name: 'Priority',
        value: (proposal.priority || 'medium').toUpperCase(),
        inline: true,
      },
      ...(proposal.file_path
        ? [{ name: 'File', value: `\`${proposal.file_path}\``, inline: false }]
        : []),
    ],
    footer: { text: `Proposal ID: ${proposal.id}` },
    timestamp: new Date().toISOString(),
  }
}

export function createStatusUpdateEmbed(
  proposalId: string,
  status: string,
  updatedBy?: string
): DiscordEmbed {
  const statusColors: Record<string, number> = {
    pending: 0xffaa00,
    approved: 0x44ff44,
    rejected: 0xff4444,
    deployed: 0x00aaff,
    merged: 0x9944ff,
  }

  const statusEmojis: Record<string, string> = {
    pending: 'Hourglass',
    approved: 'Checkmark',
    rejected: 'X',
    deployed: 'Rocket',
    merged: 'Merged',
  }

  return {
    title: `Status Update: ${statusEmojis[status] || status}`,
    description: `Proposal \`${proposalId}\` status changed to **${status.toUpperCase()}**`,
    color: statusColors[status] || 0x5865f2,
    fields: updatedBy
      ? [{ name: 'Updated By', value: updatedBy, inline: true }]
      : [],
    timestamp: new Date().toISOString(),
  }
}

export function createDeploymentEmbed(proposal: {
  id: string
  title: string
  preview_url: string | null
  pr_url: string | null
  branch_name: string | null
}): DiscordEmbed {
  return {
    title: 'Deployment Ready',
    description: `"${proposal.title}" has been deployed to preview.`,
    color: 0x00ff88,
    fields: [
      ...(proposal.preview_url
        ? [{ name: 'Preview URL', value: proposal.preview_url, inline: true }]
        : []),
      ...(proposal.pr_url
        ? [{ name: 'Pull Request', value: proposal.pr_url, inline: true }]
        : []),
      ...(proposal.branch_name
        ? [{ name: 'Branch', value: `\`${proposal.branch_name}\``, inline: true }]
        : []),
    ],
    footer: { text: `Proposal ID: ${proposal.id}` },
    timestamp: new Date().toISOString(),
  }
}

// Discord Interaction Types
export interface DiscordInteraction {
  id: string
  type: number
  data?: {
    name: string
    options?: { name: string; value: string }[]
  }
  member?: {
    user: {
      id: string
      username: string
    }
  }
  user?: {
    id: string
    username: string
  }
  token: string
  guild_id?: string
  channel_id?: string
}

export interface DiscordInteractionResponse {
  type: number
  data?: {
    content?: string
    embeds?: DiscordEmbed[]
    flags?: number
  }
}

// Interaction Response Types
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
}

// Interaction Types
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
}

export function verifyDiscordRequest(
  signature: string,
  timestamp: string,
  body: string,
  publicKey: string
): boolean {
  // In production, use a library like 'tweetnacl' for verification
  // For now, we'll skip verification in development
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // Implement proper verification using tweetnacl
  // const nacl = require('tweetnacl')
  // return nacl.sign.detached.verify(
  //   Buffer.from(timestamp + body),
  //   Buffer.from(signature, 'hex'),
  //   Buffer.from(publicKey, 'hex')
  // )
  
  return true // Placeholder - implement proper verification in production
}
