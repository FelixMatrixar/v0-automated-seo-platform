import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Octokit } from 'octokit'
import { runSEOScan } from '@/lib/agents'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get repository
    const { data: repository } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // Get GitHub token
    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token')
      .eq('id', user.id)
      .single()

    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token || profile?.github_access_token

    if (!providerToken) {
      return NextResponse.json(
        { error: 'GitHub token not found' },
        { status: 401 }
      )
    }

    const octokit = new Octokit({ auth: providerToken })
    const [owner, repo] = repository.full_name.split('/')

    // Fetch relevant files for SEO analysis
    // Focus on pages, layouts, and components
    const filePaths = [
      'app/page.tsx',
      'app/layout.tsx',
      'app/about/page.tsx',
      'app/blog/page.tsx',
      'pages/index.tsx',
      'pages/_app.tsx',
      'src/app/page.tsx',
      'src/app/layout.tsx',
    ]

    const fileContents: { path: string; content: string }[] = []

    for (const path of filePaths) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
        })

        if ('content' in data && data.type === 'file') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8')
          fileContents.push({ path, content })
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    // Also try to get the tree to find more page files
    try {
      const { data: tree } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: repository.default_branch,
        recursive: 'true',
      })

      const pageFiles = tree.tree
        .filter(item => 
          item.type === 'blob' && 
          item.path && 
          (item.path.includes('/page.tsx') || item.path.includes('/page.js')) &&
          !fileContents.some(f => f.path === item.path)
        )
        .slice(0, 10) // Limit to 10 more files

      for (const file of pageFiles) {
        if (file.path) {
          try {
            const { data } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.path,
            })

            if ('content' in data && data.type === 'file') {
              const content = Buffer.from(data.content, 'base64').toString('utf-8')
              fileContents.push({ path: file.path, content })
            }
          } catch {
            // Skip on error
          }
        }
      }
    } catch {
      // Tree fetch failed, continue with what we have
    }

    if (fileContents.length === 0) {
      return NextResponse.json(
        { error: 'No analyzable files found in repository' },
        { status: 400 }
      )
    }

    // Get scan type from request body
    const body = await request.json().catch(() => ({}))
    const scanType = body.scanType || 'full'

    // Run the SEO scan
    const result = await runSEOScan(
      repository,
      user.id,
      fileContents,
      scanType
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Save proposals to database
    const proposals = []
    for (const proposalData of result.proposals) {
      const { data: proposal } = await supabase
        .from('proposals')
        .insert({
          repository_id: repository.id,
          title: proposalData.title,
          description: proposalData.description,
          proposal_type: proposalData.proposalType,
          file_path: proposalData.filePath,
          original_content: proposalData.originalContent,
          proposed_content: proposalData.proposedContent,
          status: 'pending',
        })
        .select()
        .single()

      if (proposal) {
        proposals.push(proposal)
      }
    }

    // Update last scan time
    await supabase
      .from('repositories')
      .update({ last_scan_at: new Date().toISOString() })
      .eq('id', repository.id)

    return NextResponse.json({
      success: true,
      proposals,
      filesAnalyzed: fileContents.length,
      duration: result.duration,
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Failed to run scan' },
      { status: 500 }
    )
  }
}
