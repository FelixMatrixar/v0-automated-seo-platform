'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import {
  ArrowLeft,
  GitPullRequest,
  ExternalLink,
  Check,
  X,
  Rocket,
  GitMerge,
  FileCode,
  Clock,
  MessageSquare,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Proposal } from '@/lib/types'

export default function ProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    fetchProposal()
  }, [params.id])

  async function fetchProposal() {
    try {
      const res = await fetch(`/api/proposals/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setProposal(data)
      }
    } catch (error) {
      console.error('Error fetching proposal:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action: 'approve' | 'reject' | 'deploy' | 'merge') {
    setActionLoading(action)
    try {
      let endpoint = `/api/proposals/${params.id}`
      let method = 'PATCH'
      let body: Record<string, unknown> = {}

      if (action === 'deploy') {
        endpoint = `/api/proposals/${params.id}/deploy`
        method = 'POST'
      } else if (action === 'merge') {
        endpoint = `/api/proposals/${params.id}/merge`
        method = 'POST'
      } else {
        body = { status: action === 'approve' ? 'approved' : 'rejected', feedback }
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        await fetchProposal()
        setFeedback('')
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/20 text-warning border-warning/30'
      case 'approved':
        return 'bg-success/20 text-success border-success/30'
      case 'rejected':
        return 'bg-destructive/20 text-destructive border-destructive/30'
      case 'deployed':
        return 'bg-accent/20 text-accent border-accent/30'
      case 'merged':
        return 'bg-primary/20 text-primary border-primary/30'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Proposal not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/proposals">Back to Proposals</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/proposals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-balance">{proposal.title}</h1>
            <Badge variant="outline" className={getStatusColor(proposal.status)}>
              {proposal.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {proposal.proposal_type.replace('_', ' ')} improvement
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {proposal.description || 'No description provided'}
              </p>
            </CardContent>
          </Card>

          {/* Code Changes */}
          {(proposal.original_content || proposal.proposed_content) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCode className="h-5 w-5" />
                    Code Changes
                  </CardTitle>
                  {proposal.file_path && (
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {proposal.file_path}
                    </code>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {proposal.original_content && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Original</p>
                    <pre className="bg-muted/50 border border-destructive/20 rounded-lg p-4 overflow-x-auto text-sm">
                      <code>{proposal.original_content}</code>
                    </pre>
                  </div>
                )}
                {proposal.proposed_content && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Proposed</p>
                    <pre className="bg-muted/50 border border-success/20 rounded-lg p-4 overflow-x-auto text-sm">
                      <code>{proposal.proposed_content}</code>
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Feedback Section */}
          {proposal.status === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Feedback
                </CardTitle>
                <CardDescription>
                  Add optional feedback when approving or rejecting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add your feedback here..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading !== null}
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    {actionLoading === 'approve' ? (
                      <Spinner className="h-4 w-4 mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === 'reject' ? (
                      <Spinner className="h-4 w-4 mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback History */}
          {Array.isArray(proposal.feedback) && proposal.feedback.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Feedback History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposal.feedback.map((fb: { action: string; comment: string; created_at: string }, idx: number) => (
                    <div key={idx} className="border-l-2 border-muted pl-4 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className={getStatusColor(fb.action)}>
                          {fb.action}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(fb.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {fb.comment && (
                        <p className="text-sm mt-1">{fb.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposal.status === 'approved' && !proposal.pr_number && (
                <Button
                  className="w-full"
                  onClick={() => handleAction('deploy')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'deploy' ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <Rocket className="h-4 w-4 mr-2" />
                  )}
                  Deploy to Preview
                </Button>
              )}

              {(proposal.status === 'deployed' || (proposal.status === 'approved' && proposal.pr_number)) && (
                <Button
                  className="w-full bg-primary"
                  onClick={() => handleAction('merge')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'merge' ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <GitMerge className="h-4 w-4 mr-2" />
                  )}
                  Merge to Production
                </Button>
              )}

              {proposal.pr_url && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={proposal.pr_url} target="_blank" rel="noopener noreferrer">
                    <GitPullRequest className="h-4 w-4 mr-2" />
                    View Pull Request
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </a>
                </Button>
              )}

              {proposal.preview_url && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={proposal.preview_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Preview
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{proposal.proposal_type.replace('_', ' ')}</span>
              </div>

              {proposal.branch_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch</span>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                    {proposal.branch_name}
                  </code>
                </div>
              )}

              {proposal.pr_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PR Number</span>
                  <span>#{proposal.pr_number}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Created</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Updated</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(proposal.updated_at), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* v0 Session */}
          {proposal.v0_session_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">v0 Session</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a
                    href={`https://v0.dev/chat/${proposal.v0_session_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in v0
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
