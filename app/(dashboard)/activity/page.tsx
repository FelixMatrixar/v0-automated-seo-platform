import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Code, MessageSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { AgentLog, AgentType, AgentStatus } from '@/lib/types'

const agentConfig: Record<AgentType, { icon: typeof Search; label: string; color: string }> = {
  researcher: { icon: Search, label: 'Researcher', color: 'bg-accent/20 text-accent' },
  implementation: { icon: Code, label: 'Implementation', color: 'bg-primary/20 text-primary' },
  facilitator: { icon: MessageSquare, label: 'Facilitator', color: 'bg-warning/20 text-warning' },
}

const statusColors: Record<AgentStatus, string> = {
  running: 'bg-warning/20 text-warning border-warning/30',
  completed: 'bg-success/20 text-success border-success/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
}

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: logs } = await supabase
    .from('agent_logs')
    .select('*, repository:repositories(full_name)')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const agentLogs = (logs || []) as (AgentLog & { repository?: { full_name: string } })[]

  // Group by date
  const groupedLogs: Record<string, typeof agentLogs> = {}
  agentLogs.forEach((log) => {
    const date = new Date(log.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    if (!groupedLogs[date]) {
      groupedLogs[date] = []
    }
    groupedLogs[date].push(log)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Activity</h1>
        <p className="text-muted-foreground">
          Monitor AI agent actions and workflow progress
        </p>
      </div>

      {/* Agent Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['researcher', 'implementation', 'facilitator'] as AgentType[]).map((type) => {
          const config = agentConfig[type]
          const Icon = config.icon
          const count = agentLogs.filter(l => l.agent_type === type).length

          return (
            <Card key={type} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{config.label} Agent</p>
                    <p className="text-xl font-bold text-foreground">{count} actions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Activity Timeline */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Activity Timeline</CardTitle>
          <CardDescription>Recent agent actions and events</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedLogs).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No agent activity yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Connect a repository and run a scan to start
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedLogs).map(([date, logs]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-4">
                    {date}
                  </h3>
                  <div className="space-y-4">
                    {logs.map((log) => {
                      const config = agentConfig[log.agent_type]
                      const Icon = config.icon
                      const StatusIcon = log.status === 'running' 
                        ? Loader2 
                        : log.status === 'completed' 
                          ? CheckCircle 
                          : XCircle

                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border"
                        >
                          <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                {config.label} Agent
                              </span>
                              <Badge variant="outline" className={statusColors[log.status]}>
                                <StatusIcon className={`w-3 h-3 mr-1 ${log.status === 'running' ? 'animate-spin' : ''}`} />
                                {log.status}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-foreground mt-1">
                              {log.action}
                            </p>
                            
                            {log.repository && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Repository: {log.repository.full_name}
                              </p>
                            )}

                            {log.error_message && (
                              <p className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
                                {log.error_message}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>
                                {new Date(log.created_at).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {log.duration_ms && (
                                <span>Duration: {(log.duration_ms / 1000).toFixed(1)}s</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
