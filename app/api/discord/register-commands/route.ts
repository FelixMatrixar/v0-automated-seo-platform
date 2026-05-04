import { NextResponse } from 'next/server'

// Discord slash command definitions
const commands = [
  {
    name: 'propose',
    description: 'Propose a change to your website - AI will implement it automatically',
    options: [
      {
        name: 'change',
        description: 'Describe the change you want (e.g., "Add a testimonials section")',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'repo',
        description: 'Repository name (uses default if not specified)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'feedback',
    description: 'Submit feedback for the AI to analyze and create improvements',
    options: [
      {
        name: 'message',
        description: 'Your feedback or suggestion',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'repo',
        description: 'Repository name (optional if channel is linked)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'request',
    description: 'Request a new feature or change',
    options: [
      {
        name: 'description',
        description: 'Describe what you want to add or change',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'type',
        description: 'Type of change',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'Component', value: 'component' },
          { name: 'SEO Update', value: 'seo' },
          { name: 'Content', value: 'content' },
          { name: 'Performance', value: 'performance' },
        ],
      },
      {
        name: 'repo',
        description: 'Repository name (optional if channel is linked)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'approve',
    description: 'Approve a proposal and start deployment',
    options: [
      {
        name: 'proposal_id',
        description: 'The proposal ID (first 8 characters)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'reject',
    description: 'Reject a proposal',
    options: [
      {
        name: 'proposal_id',
        description: 'The proposal ID (first 8 characters)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for rejection (optional)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'ship',
    description: 'Merge an approved proposal to production',
    options: [
      {
        name: 'proposal_id',
        description: 'The proposal ID (first 8 characters)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'status',
    description: 'Check status of proposals',
    options: [
      {
        name: 'proposal_id',
        description: 'Specific proposal ID (optional, shows recent if omitted)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
]

export async function POST() {
  const applicationId = process.env.DISCORD_APPLICATION_ID
  const botToken = process.env.DISCORD_BOT_TOKEN

  if (!applicationId || !botToken) {
    return NextResponse.json(
      { error: 'Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN' },
      { status: 400 }
    )
  }

  try {
    // Register global commands
    const response = await fetch(
      `https://discord.com/api/v10/applications/${applicationId}/commands`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(commands),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Failed to register commands: ${error}` },
        { status: response.status }
      )
    }

    const registeredCommands = await response.json()

    return NextResponse.json({
      success: true,
      message: `Registered ${registeredCommands.length} slash commands`,
      commands: registeredCommands.map((cmd: { name: string; id: string }) => ({
        name: cmd.name,
        id: cmd.id,
      })),
    })
  } catch (error) {
    console.error('Command registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register commands' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to register Discord slash commands',
    commands: commands.map(c => ({ name: c.name, description: c.description })),
  })
}
