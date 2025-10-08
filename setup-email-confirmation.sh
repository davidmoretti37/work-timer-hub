#!/bin/bash

# Email Confirmation Setup Script
# This script helps configure email confirmation for your app

echo "================================================"
echo "Email Confirmation Setup for Work Timer Hub"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npm/npx not found. Please install Node.js first."
    exit 1
fi

echo "✓ Node.js/npm found"
echo ""

# Prompt for Resend API key
echo "📧 Step 1: Resend API Key"
echo "----------------------------------------"
echo "Get your Resend API key from: https://resend.com/api-keys"
echo ""
read -p "Enter your Resend API Key (or press Enter to skip): " RESEND_KEY

if [ ! -z "$RESEND_KEY" ]; then
    # Add to .env if not already there
    if grep -q "RESEND_API_KEY" .env 2>/dev/null; then
        echo "⚠️  RESEND_API_KEY already exists in .env"
    else
        echo "RESEND_API_KEY=$RESEND_KEY" >> .env
        echo "✓ Added RESEND_API_KEY to .env"
    fi
else
    echo "⚠️  Skipped Resend API key configuration"
fi

echo ""
echo "🔗 Step 2: Link Supabase Project"
echo "----------------------------------------"
read -p "Link to Supabase project? (y/n): " LINK_PROJECT

if [ "$LINK_PROJECT" = "y" ] || [ "$LINK_PROJECT" = "Y" ]; then
    npx supabase link --project-ref mkisayjvfcthkppiatmr
    
    if [ $? -eq 0 ]; then
        echo "✓ Project linked successfully"
    else
        echo "❌ Failed to link project"
    fi
else
    echo "⚠️  Skipped project linking"
fi

echo ""
echo "🚀 Step 3: Deploy Edge Function"
echo "----------------------------------------"
read -p "Deploy send-signup-confirmation function? (y/n): " DEPLOY_FUNCTION

if [ "$DEPLOY_FUNCTION" = "y" ] || [ "$DEPLOY_FUNCTION" = "Y" ]; then
    npx supabase functions deploy send-signup-confirmation
    
    if [ $? -eq 0 ]; then
        echo "✓ Function deployed successfully"
    else
        echo "❌ Failed to deploy function"
    fi
else
    echo "⚠️  Skipped function deployment"
fi

echo ""
echo "🔐 Step 4: Set Supabase Secrets"
echo "----------------------------------------"

if [ ! -z "$RESEND_KEY" ]; then
    read -p "Set RESEND_API_KEY secret in Supabase? (y/n): " SET_SECRET
    
    if [ "$SET_SECRET" = "y" ] || [ "$SET_SECRET" = "Y" ]; then
        npx supabase secrets set RESEND_API_KEY="$RESEND_KEY"
        
        if [ $? -eq 0 ]; then
            echo "✓ Secret set successfully"
        else
            echo "❌ Failed to set secret"
        fi
    else
        echo "⚠️  Skipped setting secret"
    fi
else
    echo "⚠️  No Resend API key to set"
fi

echo ""
echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "📋 Next Steps:"
echo "1. Configure Supabase Dashboard:"
echo "   • Go to: https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/auth/url-configuration"
echo "   • Set Site URL: http://localhost:5173"
echo "   • Add Redirect URLs:"
echo "     - http://localhost:5173/auth"
echo "     - http://localhost:5173/auth?confirmed=1"
echo "     - http://localhost:5173/**"
echo ""
echo "2. Enable Email Confirmation:"
echo "   • Go to: https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/auth/providers"
echo "   • Ensure 'Enable Email provider' is checked"
echo "   • Ensure 'Confirm email' is enabled"
echo ""
echo "3. Test the flow:"
echo "   • Run: npm run dev"
echo "   • Sign up with a test email"
echo "   • Check your inbox for confirmation email"
echo "   • Click the confirmation link"
echo ""
echo "For detailed documentation, see: EMAIL_CONFIRMATION_SETUP.md"
echo ""
