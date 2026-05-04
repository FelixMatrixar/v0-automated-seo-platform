import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Link Discord account
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { discord_user_id, default_repository_id } = await request.json()

    if (!discord_user_id) {
      return NextResponse.json(
        { error: 'Discord User ID is required' },
        { status: 400 }
      )
    }

    // Check if this Discord ID is already linked to another account
    const { data: existingLink } = await supabase
      .from('profiles')
      .select('id')
      .eq('discord_user_id', discord_user_id)
      .neq('id', user.id)
      .single()

    if (existingLink) {
      return NextResponse.json(
        { error: 'This Discord account is already linked to another user' },
        { status: 400 }
      )
    }

    // Update the profile with Discord info
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        discord_user_id,
        default_repository_id: default_repository_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to link Discord:', updateError)
      return NextResponse.json(
        { error: 'Failed to link Discord account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Discord link error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Unlink Discord account
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        discord_user_id: null,
        default_repository_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to unlink Discord:', updateError)
      return NextResponse.json(
        { error: 'Failed to unlink Discord account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Discord unlink error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
