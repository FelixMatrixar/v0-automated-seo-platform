'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, Loader2, Unlink } from 'lucide-react'

interface DiscordLinkFormProps {
  discordUserId: string
  discordUsername?: string
  defaultRepositoryId: string
  repositories: { id: string; full_name: string }[]
}

export function DiscordLinkForm({
  discordUserId,
  discordUsername,
  defaultRepositoryId,
  repositories,
}: DiscordLinkFormProps) {
  const [selectedRepo, setSelectedRepo] = useState(defaultRepositoryId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const isLinked = !!discordUserId

  const handleConnectDiscord = () => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
    if (!clientId) {
      alert('Discord integration not configured. Please contact support.')
      return
    }
    
    const redirectUri = `${window.location.origin}/auth/discord/callback`
    const scope = 'identify'
    
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`
    window.location.href = url
  }

  const handleSaveRepo = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/discord-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_repository_id: selectedRepo }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await fetch('/api/settings/discord-link', {
        method: 'DELETE',
      })
      if (res.ok) {
        window.location.reload()
      }
    } finally {
      setUnlinking(false)
    }
  }

  if (!isLinked) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your Discord to use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/propose</code> commands directly in Discord.
        </p>
        
        <Button onClick={handleConnectDiscord} className="gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Connect Discord
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          <div>
            <p className="font-medium text-foreground">{discordUsername || 'Discord User'}</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-success/20 text-success border-success/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Linked
        </Badge>
      </div>

      {repositories.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Default Repository</label>
          <Select value={selectedRepo} onValueChange={setSelectedRepo}>
            <SelectTrigger>
              <SelectValue placeholder="Select default repo for /propose" />
            </SelectTrigger>
            <SelectContent>
              {repositories.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSaveRepo} disabled={saving || !selectedRepo} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? 'Saved!' : 'Save'}
          </Button>
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Commands you can use in Discord:</p>
        <div className="flex flex-wrap gap-2">
          <code className="bg-muted px-2 py-1 rounded text-xs">/propose</code>
          <code className="bg-muted px-2 py-1 rounded text-xs">/approve</code>
          <code className="bg-muted px-2 py-1 rounded text-xs">/reject</code>
        </div>
      </div>

      <Button variant="ghost" size="sm" className="text-destructive" onClick={handleUnlink} disabled={unlinking}>
        {unlinking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unlink className="w-4 h-4 mr-1" />}
        Disconnect
      </Button>
    </div>
  )
}
