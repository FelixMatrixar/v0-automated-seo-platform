import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/settings?error=discord_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=no_code`)
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_APPLICATION_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin}/auth/discord/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Discord token error:', await tokenResponse.text())
      return NextResponse.redirect(`${origin}/settings?error=token_failed`)
    }

    const tokenData = await tokenResponse.json()

    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userResponse.ok) {
      return NextResponse.redirect(`${origin}/settings?error=user_fetch_failed`)
    }

    const discordUser = await userResponse.json()

    // Save to Supabase profile
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${origin}/auth/login?error=not_logged_in`)
    }

    // Update profile with Discord info
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        discord_user_id: discordUser.id,
        discord_username: `${discordUser.username}`,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.redirect(`${origin}/settings?error=save_failed`)
    }

    return NextResponse.redirect(`${origin}/settings?discord=connected`)
  } catch (err) {
    console.error('Discord OAuth error:', err)
    return NextResponse.redirect(`${origin}/settings?error=unknown`)
  }
}
