
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Function invoked - start')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, workspaceId, invitedBy } = await req.json()
    console.log('Request payload:', { email, workspaceId, invitedBy })

    // Log environment variables (without sensitive values)
    console.log('Environment check:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    })

    // Check if user already exists
    const { data: existingUser, error: userError } = await supabaseClient.auth.admin.getUserByEmail(email)
    console.log('User lookup result:', { exists: !!existingUser, error: userError?.message })

    let userId: string

    if (!existingUser) {
      console.log('Creating new user')
      // Create new user if they don't exist
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (createError) {
        console.error('Error creating user:', createError)
        throw createError
      }
      userId = newUser.user.id
      console.log('New user created:', userId)
    } else {
      userId = existingUser.user.id
      console.log('Using existing user:', userId)
    }

    console.log('Creating workspace invitation')
    // Create workspace invitation
    const { data: invitation, error: inviteError } = await supabaseClient
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        invited_email: email,
        invited_by: invitedBy,
        status: 'pending',
        role: 'member'
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      throw inviteError
    }

    console.log('Successfully created invitation:', invitation)

    return new Response(
      JSON.stringify({ success: true, invitation }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in invite-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
