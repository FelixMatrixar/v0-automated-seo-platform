# Discord Bot Setup Guide

This guide will help you set up a Discord bot for the SEO Agent Platform to receive notifications and handle feedback on proposals.

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** in the top right
3. Name your application (e.g., "SEO Agent Bot")
4. Click **"Create"**

## Step 2: Create a Bot User

1. In your application settings, click **"Bot"** in the left sidebar
2. Click **"Add Bot"** and confirm
3. Under **"Privileged Gateway Intents"**, enable:
   - **Message Content Intent** (for reading commands)
4. Click **"Reset Token"** and copy the token - save this securely!

## Step 3: Set Up OAuth2

1. Click **"OAuth2"** in the left sidebar, then **"URL Generator"**
2. Under **Scopes**, select:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select:
   - Send Messages
   - Send Messages in Threads
   - Create Public Threads
   - Embed Links
   - Read Message History
   - Add Reactions
   - Use Slash Commands
4. Copy the generated URL at the bottom

## Step 4: Invite the Bot to Your Server

1. Paste the OAuth2 URL in your browser
2. Select your Discord server from the dropdown
3. Click **"Authorize"**
4. Complete the CAPTCHA

## Step 5: Create a Webhook (for notifications)

1. In your Discord server, go to the channel where you want notifications
2. Click the gear icon (Edit Channel)
3. Go to **"Integrations"** > **"Webhooks"**
4. Click **"New Webhook"**
5. Name it (e.g., "SEO Agent Notifications")
6. Copy the **Webhook URL**

## Step 6: Configure Environment Variables

Add the following environment variables to your Vercel project:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_WEBHOOK_URL=your_webhook_url_here
DISCORD_APPLICATION_ID=your_application_id_here
DISCORD_PUBLIC_KEY=your_public_key_here
```

You can find the Application ID and Public Key in your Discord application's **"General Information"** section.

## Step 7: Register Slash Commands

The platform will automatically register the following slash commands when deployed:

- `/deploy <proposal_id>` - Deploy a proposal to preview
- `/approve <proposal_id>` - Approve a proposal
- `/reject <proposal_id> [reason]` - Reject a proposal with optional reason
- `/status <proposal_id>` - Check the status of a proposal
- `/list` - List recent pending proposals

## Step 8: Set Up Interaction Endpoint

1. In your Discord application settings, go to **"General Information"**
2. Set the **Interactions Endpoint URL** to:
   ```
   https://your-domain.vercel.app/api/discord/webhook
   ```
3. Discord will verify the endpoint automatically

## Notification Types

The bot will send notifications for:

- **New Proposals** - When the AI agents create a new SEO improvement proposal
- **Status Changes** - When proposals are approved, rejected, deployed, or merged
- **Deployment Ready** - When a preview deployment is ready for review
- **Merge Complete** - When changes are merged to production

## Customization

You can customize notification behavior in your settings at `/settings` in the dashboard:

- Choose which channels receive notifications
- Filter by repository
- Set notification frequency
- Enable/disable specific notification types

## Troubleshooting

### Bot not responding to commands

1. Ensure the bot has proper permissions in the channel
2. Check that the bot is online in your server
3. Verify the Interactions Endpoint URL is correct

### Notifications not appearing

1. Verify the webhook URL is correct
2. Check that the webhook wasn't deleted
3. Ensure the channel still exists

### Command registration failed

1. Wait a few minutes - Discord command registration can take up to an hour
2. Check that your Application ID is correct
3. Verify your bot token has the correct permissions

## Security Notes

- Never share your bot token publicly
- Rotate tokens immediately if compromised
- Use environment variables, never hardcode credentials
- The webhook URL should also be kept private
