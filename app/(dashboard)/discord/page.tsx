'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'

export default function DiscordPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [botToken, setBotToken] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleTestWebhook() {
    if (!webhookUrl) return
    
    setIsTesting(true)
    try {
      const response = await fetch('/api/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl }),
      })
      
      if (response.ok) {
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Failed to test webhook:', error)
    } finally {
      setIsTesting(false)
    }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText('https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=277025508352&scope=bot%20applications.commands')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discord Integration</h1>
        <p className="text-muted-foreground">
          Connect Discord for proposal notifications and approval workflows
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setup Guide */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />
              Discord Bot Setup
            </CardTitle>
            <CardDescription>
              Follow these steps to set up your Discord bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Create a Discord Application</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Go to the Discord Developer Portal and create a new application
                  </p>
                  <a 
                    href="https://discord.com/developers/applications" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    Open Developer Portal
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Create a Bot</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    In your application settings, go to Bot and click Add Bot
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Copy Bot Token</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click Reset Token and copy it - you will need this below
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                  4
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Invite Bot to Server</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use OAuth2 URL Generator with bot scope and required permissions
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={copyInviteLink}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Invite Link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                  5
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Create Webhook (Optional)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    In your Discord channel settings, create a webhook for notifications
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Configuration
              {isConnected && (
                <Badge variant="outline" className="bg-success/20 text-success border-success/30 ml-auto">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Enter your Discord bot credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                type="password"
                placeholder="Enter your Discord bot token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for slash commands and interactive messages
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for sending notification messages to a specific channel
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleTestWebhook}
                disabled={!webhookUrl || isTesting}
                variant="outline"
              >
                {isTesting ? 'Testing...' : 'Test Webhook'}
              </Button>
              <Button disabled={!botToken}>
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slash Commands */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Available Slash Commands</CardTitle>
          <CardDescription>
            Commands your team can use to interact with proposals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <code className="text-sm font-mono text-primary">/seo deploy [proposal_id]</code>
              <p className="text-sm text-muted-foreground mt-2">
                Approve and deploy a proposal to preview
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <code className="text-sm font-mono text-primary">/seo reject [proposal_id]</code>
              <p className="text-sm text-muted-foreground mt-2">
                Reject a proposal with optional feedback
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <code className="text-sm font-mono text-primary">/seo status [proposal_id]</code>
              <p className="text-sm text-muted-foreground mt-2">
                Check the current status of a proposal
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <code className="text-sm font-mono text-primary">/seo merge [proposal_id]</code>
              <p className="text-sm text-muted-foreground mt-2">
                Merge an approved proposal to production
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
