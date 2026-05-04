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

/**
 * Send a follow-up message to a Discord interaction
 * Used for async responses after the initial 3-second window
 */
export async function sendDiscordFollowUp(
  applicationId: string,
  interactionToken: string,
  payload: DiscordWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `Discord follow-up error (${response.status}): ${text}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Discord Interaction Types
export interface DiscordInteraction {
  id: string
  application_id: string
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
  try {
    // Skip verification if no public key
    if (!publicKey || !signature || !timestamp) {
      console.log('[v0] Discord verification skipped - missing params')
      return false
    }

    // Use tweetnacl for Ed25519 signature verification
    const nacl = require('tweetnacl')
    
    const message = Buffer.from(timestamp + body)
    const sig = Buffer.from(signature, 'hex')
    const key = Buffer.from(publicKey, 'hex')
    
    const isValid = nacl.sign.detached.verify(message, sig, key)
    
    if (!isValid) {
      console.log('[v0] Discord signature verification failed')
    }
    
    return isValid
  } catch (error) {
    console.error('[v0] Discord verification error:', error)
    return false
  }
}

/**
 * Get the Discord webhook URL for a user
 * Falls back to global env var if user hasn't configured their own
 */
export async function getUserWebhookUrl(userId: string): Promise<string | null> {
  // Import dynamically to avoid circular dependencies
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('discord_webhook_url')
    .eq('id', userId)
    .single()
  
  // Use user's webhook if configured, otherwise fall back to global
  return profile?.discord_webhook_url || process.env.DISCORD_WEBHOOK_URL || null
}

/**
 * Send a notification to a user's configured Discord channel
 */
export async function sendUserNotification(
  userId: string,
  payload: DiscordWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = await getUserWebhookUrl(userId)
  
  if (!webhookUrl) {
    return { 
      success: false, 
      error: 'No Discord webhook configured. Please set up Discord in Settings.' 
    }
  }
  
  return sendDiscordWebhook(webhookUrl, payload)
}

/**
 * Send a proposal notification to Discord
 * Uses the global webhook URL (for platform-level notifications)
 */
export async function sendProposalNotification(
  proposal: {
    id: string
    title: string
    description?: string | null
    status: string
    proposal_type: string
    file_path?: string | null
    pr_url?: string | null
    preview_url?: string | null
    branch_name?: string | null
  },
  repoFullName: string
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  
  if (!webhookUrl) {
    return { success: false, error: 'DISCORD_WEBHOOK_URL not configured' }
  }
  
  const statusColors: Record<string, number> = {
    pending: 0xffaa00,
    approved: 0x44ff44,
    rejected: 0xff4444,
    deployed: 0x00aaff,
    merged: 0x9944ff,
  }
  
  const statusEmojis: Record<string, string> = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌',
    deployed: '🚀',
    merged: '🔀',
  }
  
  const typeLabels: Record<string, string> = {
    seo_meta: 'SEO Metadata',
    content: 'Content Update',
    component: 'Component Change',
    performance: 'Performance Fix',
  }
  
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Repository', value: repoFullName, inline: true },
    { name: 'Type', value: typeLabels[proposal.proposal_type] || proposal.proposal_type, inline: true },
    { name: 'Status', value: `${statusEmojis[proposal.status] || ''} ${proposal.status.toUpperCase()}`, inline: true },
  ]
  
  if (proposal.file_path) {
    fields.push({ name: 'File', value: `\`${proposal.file_path}\``, inline: false })
  }
  
  if (proposal.preview_url) {
    fields.push({ name: 'Preview', value: proposal.preview_url, inline: true })
  }
  
  if (proposal.pr_url) {
    fields.push({ name: 'Pull Request', value: proposal.pr_url, inline: true })
  }
  
  return sendDiscordWebhook(webhookUrl, {
    embeds: [{
      title: `${statusEmojis[proposal.status] || '📋'} ${proposal.title}`,
      description: proposal.description || 'No description provided',
      color: statusColors[proposal.status] || 0x5865f2,
      fields,
      footer: { text: `Proposal ID: ${proposal.id}` },
      timestamp: new Date().toISOString(),
    }],
  })
}
