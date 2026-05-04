'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Proposal, ProposalStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, XCircle, Rocket, GitMerge, Loader2 } from 'lucide-react'

const statusConfig: Record<ProposalStatus, { icon: typeof Clock; label: string; color: string }> = {
  pending: { icon: Clock, label: 'Pending', color: 'bg-warning/20 text-warning' },
  approved: { icon: CheckCircle, label: 'Approved', color: 'bg-success/20 text-success' },
  rejected: { icon: XCircle, label: 'Rejected', color: 'bg-destructive/20 text-destructive' },
  deployed: { icon: Rocket, label: 'Deployed', color: 'bg-accent/20 text-accent' },
  merged: { icon: GitMerge, label: 'Merged', color: 'bg-primary/20 text-primary' },
}

export function ProposalPipeline() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProposals() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Get user's repositories first
      const { data: repos } = await supabase
        .from('repositories')
        .select('id')
        .eq('user_id', user.id)

      if (!repos || repos.length === 0) {
        setIsLoading(false)
        return
      }

      const repoIds = repos.map(r => r.id)

      const { data } = await supabase
        .from('proposals')
        .select('*, repository:repositories(full_name)')
        .in('repository_id', repoIds)
        .order('created_at', { ascending: false })
        .limit(5)

      setProposals(data || [])
      setIsLoading(false)
    }

    fetchProposals()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">No proposals yet</p>
        <p className="text-muted-foreground text-xs mt-1">
          Run an SEO scan to generate improvement proposals
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {proposals.map((proposal) => {
        const config = statusConfig[proposal.status]
        const Icon = config.icon

        return (
          <div
            key={proposal.id}
            className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50 border border-border"
          >
            <div className={`w-8 h-8 rounded-lg ${config.color} flex items-center justify-center shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {proposal.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {(proposal.repository as { full_name: string } | undefined)?.full_name || 'Unknown repo'}
              </p>
            </div>
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
