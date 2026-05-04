import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  GitBranch, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  Activity,
  Zap,
  ArrowRight,
  Plus
} from 'lucide-react'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { ProposalPipeline } from '@/components/dashboard/proposal-pipeline'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats
  const [reposResult, proposalsResult, logsResult] = await Promise.all([
    supabase.from('repositories').select('id', { count: 'exact' }).eq('user_id', user?.id),
    supabase.from('proposals').select('id, status, repository_id').eq('repository_id', user?.id),
    supabase.from('agent_logs').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(10),
  ])

  // Get proposals through repositories
  const { data: repos } = await supabase
    .from('repositories')
    .select('id')
    .eq('user_id', user?.id)

  const repoIds = repos?.map(r => r.id) || []
  
  let proposals: { id: string; status: string }[] = []
  if (repoIds.length > 0) {
    const { data } = await supabase
      .from('proposals')
      .select('id, status')
      .in('repository_id', repoIds)
    proposals = data || []
  }

  const stats = {
    repositories: reposResult.count || 0,
    totalProposals: proposals.length,
    pendingProposals: proposals.filter(p => p.status === 'pending').length,
    approvedProposals: proposals.filter(p => p.status === 'approved').length,
    deployedProposals: proposals.filter(p => p.status === 'deployed' || p.status === 'merged').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connected Repos
            </CardTitle>
            <GitBranch className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.repositories}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active repositories
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <Clock className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.pendingProposals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.approvedProposals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready to deploy
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deployed
            </CardTitle>
            <Zap className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.deployedProposals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Live in production
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common tasks and workflows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/repositories/connect">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Connect Repository
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/proposals">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  View Proposals
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/activity">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Agent Activity
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-card border-border col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Proposal Pipeline</CardTitle>
              <CardDescription>Track proposals through the workflow</CardDescription>
            </div>
            <Link href="/proposals">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ProposalPipeline />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Agent Activity</CardTitle>
            <CardDescription>Latest actions from your AI agents</CardDescription>
          </div>
          <Link href="/activity">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <RecentActivity />
        </CardContent>
      </Card>
    </div>
  )
}
