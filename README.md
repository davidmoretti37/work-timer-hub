# Work Timer Hub

A comprehensive time tracking and PTO (Paid Time Off) management application built with React, TypeScript, and Supabase.

## Project Structure

This project is organized as a monorepo with clear separation between frontend and backend components:

```
work-timer-hub/
├── frontend/                 # React/Vite frontend application
│   ├── src/                 # Source code
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   ├── integrations/   # External service integrations
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   ├── dist/               # Build output
│   ├── package.json        # Frontend dependencies
│   ├── vite.config.ts      # Vite configuration
│   ├── tailwind.config.ts  # Tailwind CSS configuration
│   └── tsconfig.json       # TypeScript configuration
├── backend/                 # Supabase backend services
│   ├── supabase/           # Supabase project files
│   │   ├── functions/      # Edge functions
│   │   ├── migrations/     # Database migrations
│   │   └── config.toml     # Supabase configuration
│   ├── infra/              # Infrastructure configuration
│   └── package.json        # Backend dependencies
├── package.json            # Root package.json (monorepo management)
└── README.md              # This file
```

## Features

- **Time Tracking**: Track work sessions with start/stop functionality
- **PTO Management**: Request and manage paid time off
- **Admin Dashboard**: Approve PTO requests and manage users
- **Calendar Integration**: View time tracking and PTO on calendar
- **Email Notifications**: Automated email confirmations and notifications
- **Responsive Design**: Mobile-friendly interface with dark/light themes

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **React Router** for navigation
- **React Hook Form** for form management
- **Framer Motion** for animations

### Backend
- **Supabase** for backend-as-a-service
- **PostgreSQL** database
- **Edge Functions** for serverless functions
- **Row Level Security** for data protection
- **Email integration** via Resend

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 8+
- Supabase CLI (for backend development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd work-timer-hub
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env.local` in the frontend directory
   - Add your Supabase URL and anon key

4. **Start development servers**
   ```bash
   npm run dev
   ```

This will start both the frontend (Vite dev server) and backend (Supabase local development) simultaneously.

### Individual Development

**Frontend only:**
```bash
cd frontend
npm run dev
```

**Backend only:**
```bash
cd backend
npm run dev
```

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run install:all` - Install dependencies for all workspaces
- `npm run clean` - Clean all node_modules and build artifacts

### Frontend
- `npm run dev:frontend` - Start Vite development server
- `npm run build:frontend` - Build for production
- `npm run preview:frontend` - Preview production build
- `npm run lint` - Run ESLint

### Backend
- `npm run dev:backend` - Start Supabase local development
- `npm run deploy:backend` - Deploy Supabase functions
- `npm run migrate:backend` - Run database migrations

## Deployment

### Frontend
The frontend can be deployed to any static hosting service:
- Vercel (recommended)
- Netlify
- GitHub Pages

### Backend
The backend uses Supabase, which handles:
- Database hosting
- Edge function deployment
- Authentication
- Real-time subscriptions

## Development Workflow

1. **Database Changes**: Create migrations in `backend/supabase/migrations/`
2. **API Functions**: Add edge functions in `backend/supabase/functions/`
3. **Frontend Features**: Develop components in `frontend/src/`
4. **Testing**: Run tests and linting before committing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.