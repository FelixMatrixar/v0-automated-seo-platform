import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Octokit } from 'octokit'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's GitHub access token from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token')
      .eq('id', user.id)
      .single()

    // Get the provider token from the session
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token || profile?.github_access_token

    if (!providerToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found. Please re-authenticate.' },
        { status: 401 }
      )
    }

    // Store the token for future use
    if (session?.provider_token && session.provider_token !== profile?.github_access_token) {
      await supabase
        .from('profiles')
        .update({ github_access_token: session.provider_token })
        .eq('id', user.id)
    }

    const octokit = new Octokit({ auth: providerToken })

    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
      affiliation: 'owner,collaborator,organization_member',
    })

    const repositories = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      default_branch: repo.default_branch,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      language: repo.language,
      updated_at: repo.updated_at,
    }))

    return NextResponse.json({ repositories })
  } catch (error) {
    console.error('Error fetching GitHub repos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}
