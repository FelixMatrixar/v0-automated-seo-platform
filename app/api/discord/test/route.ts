import { NextResponse } from 'next/server'
import { sendDiscordWebhook } from '@/lib/discord'

export async function POST(request: Request) {
  try {
    const { webhook_url } = await request.json()

    if (!webhook_url) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
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
