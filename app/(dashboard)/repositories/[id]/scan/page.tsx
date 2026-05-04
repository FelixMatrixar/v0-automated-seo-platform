'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Scan, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileText,
  ArrowLeft,
  Zap
} from 'lucide-react'
import Link from 'next/link'

interface ScanResult {
  success: boolean
  proposals: {
    id: string
    title: string
    proposal_type: string
  }[]
  filesAnalyzed: number
  duration: number
  error?: string
}

export default function ScanPage() {
  const router = useRouter()
  const params = useParams()
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanType, setScanType] = useState<'full' | 'quick' | 'metadata_only'>('full')

  async function runScan() {
    setIsScanning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/repositories/${params.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run scan')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/repositories">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">SEO Scan</h1>
          <p className="text-muted-foreground">
            Analyze your repository for SEO improvements
          </p>
        </div>
      </div>

      {/* Scan Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scan className="w-5 h-5" />
            Scan Configuration
          </CardTitle>
          <CardDescription>
            Choose the type of analysis to run
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setScanType('metadata_only')}
              className={`p-4 rounded-lg border text-left transition-colors ${
                scanType === 'metadata_only'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium text-foreground">Metadata Only</p>
              <p className="text-xs text-muted-foreground mt-1">
                Check titles, descriptions, and OG tags
              </p>
            </button>

            <button
              onClick={() => setScanType('quick')}
              className={`p-4 rounded-lg border text-left transition-colors ${
                scanType === 'quick'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium text-foreground">Quick Scan</p>
              <p className="text-xs text-muted-foreground mt-1">
                Metadata + heading structure
              </p>
            </button>

            <button
              onClick={() => setScanType('full')}
              className={`p-4 rounded-lg border text-left transition-colors ${
                scanType === 'full'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium text-foreground">Full Analysis</p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete SEO audit with all checks
              </p>
            </button>
          </div>

          <Button 
            onClick={runScan} 
            disabled={isScanning}
            className="w-full"
            size="lg"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Repository...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Start {scanType === 'full' ? 'Full' : scanType === 'quick' ? 'Quick' : 'Metadata'} Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Scan Failed</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Scan Complete
            </CardTitle>
            <CardDescription>
              Analyzed {result.filesAnalyzed} files in {(result.duration / 1000).toFixed(1)}s
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.proposals.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="text-foreground font-medium">Looking Good!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No SEO issues found in the analyzed files.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Found {result.proposals.length} improvement opportunities:
                </p>
                <div className="space-y-2">
                  {result.proposals.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{proposal.title}</span>
                      </div>
                      <Badge variant="outline">
                        {proposal.proposal_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href="/proposals" className="flex-1">
                    <Button className="w-full">
                      View All Proposals
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={runScan}>
                    Scan Again
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">How the SEO Agent Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-sm font-medium text-primary">
                1
              </div>
              <div>
                <p className="font-medium text-foreground">Analysis</p>
                <p className="text-sm text-muted-foreground">
                  The Researcher Agent scans your repository for page files and analyzes SEO elements.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-sm font-medium text-primary">
                2
              </div>
              <div>
                <p className="font-medium text-foreground">Proposal Generation</p>
                <p className="text-sm text-muted-foreground">
                  Issues are converted into actionable proposals with specific code changes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-sm font-medium text-primary">
                3
              </div>
              <div>
                <p className="font-medium text-foreground">Review & Deploy</p>
                <p className="text-sm text-muted-foreground">
                  Review proposals in the dashboard or via Discord, then deploy with one click.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
