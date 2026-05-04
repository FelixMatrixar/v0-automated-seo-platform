'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Link2, ExternalLink, Copy } from 'lucide-react'

interface DiscordLinkFormProps {
  discordUserId: string
  defaultRepositoryId: string
  repositories: { id: string; full_name: string }[]
}

export function DiscordLinkForm({
  discordUserId,
  defaultRepositoryId,
  repositories,
}: DiscordLinkFormProps) {
  const [userId, setUserId] = useState(discordUserId)
  const [repoId, setRepoId] = useState(defaultRepositoryId)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [showInstructions, setShowInstructions] = useState(!discordUserId)

  const isLinked = !!discordUserId

  const handleSave = async () => {
    if (!userId.trim()) {
      setError('Please enter your Discord User ID')
      setStatus('error')
      return
    }

    setStatus('saving')
    setError('')

    try {
      const response = await fetch('/api/settings/discord-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_user_id: userId.trim(),
          default_repository_id: repoId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save')
      }

      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setStatus('error')
    }
  }

  const handleUnlink = async () => {
    setStatus('saving')
    
    try {
      const response = await fetch('/api/settings/discord-link', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to unlink')
      }

      setUserId('')
      setRepoId('')
      setStatus('success')
      setShowInstructions(true)
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink')
      setStatus('error')
    }
  }

  const copyBotInvite = () => {
    const appId = process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=2147483648&scope=bot%20applications.commands`
    navigator.clipboard.writeText(inviteUrl)
  }

  return (
    <div className="space-y-6">
      {isLinked ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Discord Account Linked</span>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Discord User ID</span>
              <code className="text-sm font-mono bg-background px-2 py-1 rounded">{discordUserId}</code>
            </div>
            
            {defaultRepositoryId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Default Repository</span>
                <span className="text-sm">{repositories.find(r => r.id === defaultRepositoryId)?.full_name || 'Unknown'}</span>
              </div>
            )}
          </div>

          <div className="bg-primary/10 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">You can now use these commands in Discord:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-background px-1 rounded">/propose</code> - Propose a change to your website</li>
              <li><code className="bg-background px-1 rounded">/status</code> - Check the status of a proposal</li>
              <li><code className="bg-background px-1 rounded">/approve</code> - Approve and deploy a proposal</li>
              <li><code className="bg-background px-1 rounded">/reject</code> - Reject a proposal</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              {showInstructions ? 'Hide' : 'Edit'} Settings
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={status === 'saving'}
            >
              Unlink Account
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link2 className="w-5 h-5" />
          <span>Link your Discord account to use slash commands</span>
        </div>
      )}

      {(showInstructions || !isLinked) && (
        <div className="space-y-6 pt-4 border-t border-border">
          {/* Step 1: Get Discord User ID */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">1</Badge>
              <h4 className="font-medium text-foreground">Get Your Discord User ID</h4>
            </div>
            <div className="ml-8 space-y-2">
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open Discord and go to Settings (gear icon)</li>
                <li>Click on &quot;Advanced&quot; in the left sidebar</li>
                <li>Enable &quot;Developer Mode&quot;</li>
                <li>Right-click on your username anywhere and click &quot;Copy User ID&quot;</li>
              </ol>
            </div>
          </div>

          {/* Step 2: Enter User ID */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">2</Badge>
              <h4 className="font-medium text-foreground">Enter Your User ID</h4>
            </div>
            <div className="ml-8 space-y-3">
              <div>
                <Label htmlFor="discord-user-id">Discord User ID</Label>
                <Input
                  id="discord-user-id"
                  placeholder="e.g., 123456789012345678"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Select Default Repository */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">3</Badge>
              <h4 className="font-medium text-foreground">Select Default Repository (Optional)</h4>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Choose a default repository for quick commands without specifying a repo each time.
              </p>
              <Select value={repoId} onValueChange={setRepoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      {repo.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step 4: Invite Bot */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">4</Badge>
              <h4 className="font-medium text-foreground">Invite the Bot to Your Server</h4>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Add the SEO Agent bot to your Discord server to use slash commands.
              </p>
              <a
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID || 'YOUR_APP_ID'}&permissions=2147483648&scope=bot%20applications.commands`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Invite Bot to Server
                </Button>
              </a>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={status === 'saving'}
            >
              {status === 'saving' ? 'Saving...' : 'Link Account'}
            </Button>

            {status === 'success' && (
              <span className="text-sm text-success flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Saved successfully
              </span>
            )}

            {status === 'error' && (
              <span className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
