'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { GitBranch, Search, Loader2, Check, Lock, Globe } from 'lucide-react'
import type { GitHubRepository } from '@/lib/types'

export default function ConnectRepositoryPage() {
  const router = useRouter()
  const [repos, setRepos] = useState<GitHubRepository[]>([])
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepository[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [connectingId, setConnectingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRepos() {
      try {
        const response = await fetch('/api/github/repos')
        if (!response.ok) {
          throw new Error('Failed to fetch repositories')
        }
        const data = await response.json()
        setRepos(data.repositories || [])
        setFilteredRepos(data.repositories || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repositories')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRepos()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRepos(repos)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredRepos(
        repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(query) ||
            repo.full_name.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, repos])

  async function connectRepository(repo: GitHubRepository) {
    setConnectingId(repo.id)
    setError(null)

    try {
      const response = await fetch('/api/repositories/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_repo_id: repo.id,
          full_name: repo.full_name,
          default_branch: repo.default_branch,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to connect repository')
      }

      router.push('/repositories')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository')
      setConnectingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connect Repository</h1>
        <p className="text-muted-foreground">
          Select a GitHub repository to analyze and optimize for SEO
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Your GitHub Repositories</CardTitle>
          <CardDescription>
            Choose a repository to connect to the SEO agent platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? 'No repositories match your search' : 'No repositories found'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <GitBranch className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {repo.name}
                        </p>
                        {repo.private ? (
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Globe className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {repo.full_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {repo.language && (
                      <Badge variant="outline" className="hidden sm:flex">
                        {repo.language}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={() => connectRepository(repo)}
                      disabled={connectingId === repo.id}
                    >
                      {connectingId === repo.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Connect
                        </>
                      )}
                    </Button>
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
