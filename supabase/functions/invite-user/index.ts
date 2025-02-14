
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
    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, workspaceId, invitedBy } = await req.json()
    console.log('Processing invitation:', { email, workspaceId, invitedBy })

    // First check if there's an existing invitation
    const { data: existingInvite, error: inviteCheckError } = await supabaseClient
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('invited_email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (inviteCheckError) {
      console.error('Error checking existing invitation:', inviteCheckError)
      throw inviteCheckError
    }

    if (existingInvite) {
      console.log('Found existing pending invitation')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'An invitation for this email is already pending' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', invitedBy)
      .maybeSingle()

    if (memberCheckError) {
      console.error('Error checking existing membership:', memberCheckError)
      throw memberCheckError
    }

    if (existingMember) {
      console.log('User is already a member')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User is already a member of this workspace' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Create workspace invitation
    console.log('Creating workspace invitation')
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
      }
    )
  } catch (error) {
    console.error('Error in invite-user function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
