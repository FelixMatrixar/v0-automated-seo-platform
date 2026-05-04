'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import type { AgentLog } from '@/lib/types'
import { Search, Code, MessageSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const agentIcons = {
  researcher: Search,
  implementation: Code,
  facilitator: MessageSquare,
}

const statusColors = {
  running: 'bg-warning/20 text-warning border-warning/30',
  completed: 'bg-success/20 text-success border-success/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
}

export function RecentActivity() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data } = await supabase
        .from('agent_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setLogs(data || [])
      setIsLoading(false)
    }

    fetchLogs()

    // Set up real-time subscription
    const supabase = createClient()
    const channel = supabase
      .channel('agent_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_logs',
        },
        () => {
          fetchLogs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">No agent activity yet</p>
        <p className="text-muted-foreground text-xs mt-1">
          Connect a repository to start analyzing
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const Icon = agentIcons[log.agent_type]
        const StatusIcon = log.status === 'running' ? Loader2 : log.status === 'completed' ? CheckCircle : XCircle

        return (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground capitalize">
                  {log.agent_type} Agent
                </span>
                <Badge variant="outline" className={statusColors[log.status]}>
                  <StatusIcon className={`w-3 h-3 mr-1 ${log.status === 'running' ? 'animate-spin' : ''}`} />
                  {log.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {log.action}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                {log.duration_ms && ` • ${(log.duration_ms / 1000).toFixed(1)}s`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
