import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Github, Shield, MessageSquare, Link2 } from 'lucide-react'
import { DiscordSetupForm } from '@/components/settings/discord-setup-form'
import { DiscordLinkForm } from '@/components/settings/discord-link-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  const { data: repositories } = await supabase
    .from('repositories')
    .select('id, full_name')
    .eq('user_id', user?.id)
    .eq('is_active', true)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and integrations
        </p>
      </div>

      {/* Profile */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Your account information from GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {profile?.full_name || 'Unknown User'}
              </h3>
              <p className="text-muted-foreground">
                @{profile?.github_username || 'unknown'}
              </p>
              <p className="text-sm text-muted-foreground">
                {profile?.email || user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Connection */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="w-5 h-5" />
            GitHub Connection
          </CardTitle>
          <CardDescription>
            Your GitHub OAuth connection status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Connection Status</p>
              <p className="text-xs text-muted-foreground">
                Connected via GitHub OAuth
              </p>
            </div>
            <Badge variant="outline" className="bg-success/20 text-success border-success/30">
              Connected
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Repository Access</p>
              <p className="text-xs text-muted-foreground">
                Access to public and private repositories
              </p>
            </div>
            <Badge variant="outline">repo scope</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Discord Account Link */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Discord Account
          </CardTitle>
          <CardDescription>
            Link your Discord account to propose changes directly from Discord
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscordLinkForm 
            discordUserId={profile?.discord_user_id || ''}
            defaultRepositoryId={profile?.default_repository_id || ''}
            repositories={repositories || []}
          />
        </CardContent>
      </Card>

      {/* Discord Webhook */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Discord Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications when proposals are created or deployed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscordSetupForm 
            initialWebhookUrl={profile?.discord_webhook_url || ''} 
            initialChannelId={profile?.discord_channel_id || ''}
          />
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </CardTitle>
          <CardDescription>
            Account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">
                Managed through your GitHub account
              </p>
            </div>
            <a
              href="https://github.com/settings/security"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                Manage on GitHub
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
