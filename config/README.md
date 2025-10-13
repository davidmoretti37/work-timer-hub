# Configuration Files

This directory contains all configuration files for the Work Timer Hub project.

## 📁 Directory Structure

### `/deployment/` - Deployment Configurations
- `vercel.json` - Vercel deployment configuration
  - Configures SPA routing (all routes redirect to index.html)
  - Used for frontend deployment to Vercel
- `railway.toml` - Railway deployment configuration
  - Configures build and deployment settings
  - Used for alternative deployment to Railway

## 🔧 Configuration Files Explained

### Root Level (Keep in root)
- `package.json` - Root monorepo package management
- `package-lock.json` - NPM dependency lock file

### Frontend Configuration
- `frontend/package.json` - Frontend dependencies
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/tailwind.config.ts` - Tailwind CSS configuration
- `frontend/tsconfig.json` - TypeScript configuration

### Backend Configuration
- `backend/package.json` - Backend dependencies
- `backend/supabase/config.toml` - Supabase project configuration

## 🚀 Deployment

### Vercel (Recommended)
The project is configured for Vercel deployment with SPA routing support.

### Railway (Alternative)
Railway configuration is available as an alternative deployment option.

## 📝 Adding New Configuration

When adding new configuration files:
1. Place deployment configs in `/deployment/`
2. Place environment configs in `/environment/`
3. Update this README with new file descriptions
