import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { github_repo_id, full_name, default_branch } = body

    if (!github_repo_id || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if repository is already connected
    const { data: existing } = await supabase
      .from('repositories')
      .select('id')
      .eq('user_id', user.id)
      .eq('github_repo_id', github_repo_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Repository already connected' },
        { status: 400 }
      )
    }

    // Create the repository record
    const { data: repository, error } = await supabase
      .from('repositories')
      .insert({
        user_id: user.id,
        github_repo_id,
        full_name,
        default_branch: default_branch || 'main',
        seo_config: {
          scan_frequency: 'weekly',
          auto_create_proposals: true,
        },
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating repository:', error)
      return NextResponse.json(
        { error: 'Failed to connect repository' },
        { status: 500 }
      )
    }

    // Log the agent activity
    await supabase.from('agent_logs').insert({
      user_id: user.id,
      repository_id: repository.id,
      agent_type: 'researcher',
      action: `Connected repository: ${full_name}`,
      status: 'completed',
    })

    return NextResponse.json({ repository })
  } catch (error) {
    console.error('Error connecting repository:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
