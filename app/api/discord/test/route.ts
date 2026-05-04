import { NextResponse } from 'next/server'
import { sendDiscordWebhook } from '@/lib/discord'

export async function POST(request: Request) {
  try {
    let webhook_url: string | undefined
    
    // Try to get webhook_url from request body, fall back to env var
    try {
      const body = await request.json()
      webhook_url = body.webhook_url
    } catch {
      // No body or invalid JSON - use env var
    }
    
    webhook_url = webhook_url || process.env.DISCORD_WEBHOOK_URL

    if (!webhook_url) {
      return NextResponse.json(
        { error: 'DISCORD_WEBHOOK_URL is not configured' },
        { status: 400 }
      )
    }

    const result = await sendDiscordWebhook(webhook_url, {
      embeds: [
        {
          title: 'SEO Agent Test',
          description: 'Your Discord webhook is configured correctly!',
          color: 0x00ff88,
          fields: [
            {
              name: 'Status',
              value: 'Connected',
              inline: true,
            },
            {
              name: 'Platform',
              value: 'SEO Agent Platform',
              inline: true,
            },
          ],
          footer: {
            text: 'This is a test message from the SEO Agent Platform',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Discord test error:', error)
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    )
  }
}
