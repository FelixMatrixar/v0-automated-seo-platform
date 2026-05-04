import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, GitBranch, Settings, Scan, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Repository } from '@/lib/types'

export default async function RepositoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: repositories } = await supabase
    .from('repositories')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Repositories</h1>
          <p className="text-muted-foreground">
            Manage your connected GitHub repositories
          </p>
        </div>
        <Link href="/repositories/connect">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Connect Repository
          </Button>
        </Link>
      </div>

      {!repositories || repositories.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No repositories connected
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Connect your GitHub repositories to start analyzing SEO opportunities 
              and generating improvement proposals.
            </p>
            <Link href="/repositories/connect">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Connect Your First Repository
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repositories.map((repo: Repository) => (
            <Card key={repo.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {repo.full_name.split('/')[1]}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {repo.full_name}
                    </CardDescription>
                  </div>
                  <Badge variant={repo.is_active ? 'default' : 'secondary'}>
                    {repo.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {repo.default_branch}
                  </span>
                  {repo.last_scan_at && (
                    <span>
                      Scanned {formatDistanceToNow(new Date(repo.last_scan_at), { addSuffix: true })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/repositories/${repo.id}/scan`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Scan className="w-3 h-3 mr-1" />
                      Scan
                    </Button>
                  </Link>
                  <Link href={`/repositories/${repo.id}/settings`}>
                    <Button variant="ghost" size="sm">
                      <Settings className="w-3 h-3" />
                    </Button>
                  </Link>
                  <a
                    href={`https://github.com/${repo.full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
