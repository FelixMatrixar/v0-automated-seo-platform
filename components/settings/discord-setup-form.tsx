'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface DiscordSetupFormProps {
  initialWebhookUrl: string
  initialChannelId: string
}

export function DiscordSetupForm({ initialWebhookUrl, initialChannelId }: DiscordSetupFormProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl)
  const [channelId, setChannelId] = useState(initialChannelId)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [showInstructions, setShowInstructions] = useState(!initialWebhookUrl)
  const [copied, setCopied] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    
    try {
      const response = await fetch('/api/settings/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl, channel_id: channelId })
      })
      
      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl })
      })
      
      if (response.ok) {
        setTestResult('success')
      } else {
        setTestResult('error')
      }
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isConfigured = !!initialWebhookUrl

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Connection Status</p>
          <p className="text-xs text-muted-foreground">
            {isConfigured ? 'Webhook URL is configured' : 'Not configured yet'}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={isConfigured 
            ? "bg-success/20 text-success border-success/30" 
            : "bg-warning/20 text-warning border-warning/30"
          }
        >
          {isConfigured ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {/* Setup Instructions Toggle */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showInstructions ? 'Hide setup instructions' : 'Show setup instructions'}
      </button>

      {/* Step-by-Step Instructions */}
      {showInstructions && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
          <h4 className="font-semibold text-foreground">How to get your Discord Webhook URL</h4>
          
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Open Discord Server Settings</p>
                <p className="text-xs text-muted-foreground">
                  Right-click on your server name and select <span className="font-medium text-foreground">Server Settings</span>
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Go to Integrations</p>
                <p className="text-xs text-muted-foreground">
                  In the left sidebar, click on <span className="font-medium text-foreground">Integrations</span>
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Create Webhook</p>
                <p className="text-xs text-muted-foreground">
                  Click on <span className="font-medium text-foreground">Webhooks</span>, then <span className="font-medium text-foreground">New Webhook</span>
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Configure the Webhook</p>
                <p className="text-xs text-muted-foreground">
                  Name it <span className="font-medium text-foreground">SEO Agent</span> and select the channel where you want notifications
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                5
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Copy the Webhook URL</p>
                <p className="text-xs text-muted-foreground">
                  Click <span className="font-medium text-foreground">Copy Webhook URL</span> and paste it below
                </p>
              </div>
            </div>
          </div>

          {/* Visual Guide Link */}
          <a
            href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Discord&apos;s official webhook guide
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Webhook URL Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Webhook URL</label>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="bg-input border-border"
          />
          {webhookUrl && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyText(webhookUrl)}
              className="shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Starts with https://discord.com/api/webhooks/
        </p>
      </div>

      {/* Channel ID (Optional) */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Channel ID <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          type="text"
          placeholder="123456789012345678"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="bg-input border-border"
        />
        <p className="text-xs text-muted-foreground">
          Right-click the channel and select &quot;Copy Channel ID&quot; (requires Developer Mode enabled in Discord settings)
        </p>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          testResult === 'success' 
            ? 'bg-success/10 border border-success/30' 
            : 'bg-destructive/10 border border-destructive/30'
        }`}>
          {testResult === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Test message sent! Check your Discord channel.</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">Failed to send test message. Please check your webhook URL.</span>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button 
          onClick={handleSave} 
          disabled={saving || !webhookUrl}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleTest}
          disabled={testing || !webhookUrl}
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            'Send Test Message'
          )}
        </Button>
      </div>
    </div>
  )
}
