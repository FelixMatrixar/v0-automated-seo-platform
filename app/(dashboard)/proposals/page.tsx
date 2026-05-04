import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Rocket, 
  GitMerge,
  ExternalLink,
  Eye
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Proposal, ProposalStatus } from '@/lib/types'

const statusConfig: Record<ProposalStatus, { icon: typeof Clock; label: string; color: string; bgColor: string }> = {
  pending: { icon: Clock, label: 'Pending', color: 'text-warning', bgColor: 'bg-warning/20' },
  approved: { icon: CheckCircle, label: 'Approved', color: 'text-success', bgColor: 'bg-success/20' },
  rejected: { icon: XCircle, label: 'Rejected', color: 'text-destructive', bgColor: 'bg-destructive/20' },
  deployed: { icon: Rocket, label: 'Deployed', color: 'text-accent', bgColor: 'bg-accent/20' },
  merged: { icon: GitMerge, label: 'Merged', color: 'text-primary', bgColor: 'bg-primary/20' },
}

const typeLabels: Record<string, string> = {
  seo_meta: 'SEO Meta',
  content: 'Content',
  component: 'Component',
  performance: 'Performance',
}

export default async function ProposalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's repositories
  const { data: repos } = await supabase
    .from('repositories')
    .select('id')
    .eq('user_id', user?.id)

  const repoIds = repos?.map(r => r.id) || []
  
  let proposals: Proposal[] = []
  if (repoIds.length > 0) {
    const { data } = await supabase
      .from('proposals')
      .select('*, repository:repositories(full_name)')
      .in('repository_id', repoIds)
      .order('created_at', { ascending: false })
    proposals = (data || []) as Proposal[]
  }

  const groupedProposals = {
    all: proposals,
    pending: proposals.filter(p => p.status === 'pending'),
    approved: proposals.filter(p => p.status === 'approved'),
    deployed: proposals.filter(p => p.status === 'deployed' || p.status === 'merged'),
    rejected: proposals.filter(p => p.status === 'rejected'),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Proposals</h1>
        <p className="text-muted-foreground">
          Review and manage SEO improvement proposals
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All ({groupedProposals.all.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({groupedProposals.pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({groupedProposals.approved.length})
          </TabsTrigger>
          <TabsTrigger value="deployed">
            Deployed ({groupedProposals.deployed.length})
          </TabsTrigger>
        </TabsList>

        {Object.entries(groupedProposals).map(([key, items]) => (
          <TabsContent key={key} value={key} className="space-y-4">
            {items.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No {key === 'all' ? '' : key} proposals
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    {key === 'all'
                      ? 'Run an SEO scan on a repository to generate improvement proposals.'
                      : `No proposals are currently ${key}.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {items.map((proposal) => {
                  const config = statusConfig[proposal.status]
                  const Icon = config.icon

                  return (
                    <Card key={proposal.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground truncate">
                                  {proposal.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {proposal.description || 'No description'}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline">
                                  {typeLabels[proposal.proposal_type]}
                                </Badge>
                                <Badge className={`${config.bgColor} ${config.color} border-0`}>
                                  {config.label}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                              <span>
                                {(proposal.repository as { full_name: string } | undefined)?.full_name || 'Unknown repo'}
                              </span>
                              {proposal.file_path && (
                                <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                                  {proposal.file_path}
                                </span>
                              )}
                              <span>
                                {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                              <Link href={`/proposals/${proposal.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-3 h-3 mr-1" />
                                  View Details
                                </Button>
                              </Link>
                              {proposal.pr_url && (
                                <a href={proposal.pr_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    View PR
                                  </Button>
                                </a>
                              )}
                              {proposal.preview_url && (
                                <a href={proposal.preview_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm">
                                    <Rocket className="w-3 h-3 mr-1" />
                                    Preview
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
