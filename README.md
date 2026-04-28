# Aurea Platform

Aurea is a youth chat safety prototype that combines real-time group chat, rule-based risk detection, Aurea Bot interventions, user reporting, and admin moderation.

## Project Overview

Aurea was built as a safeguarding-focused prototype for youth group conversations. The platform is designed to show how real-time chat, explainable safety rules, supportive bot interventions, and human moderation can work together in one system.

Its main purpose is to explore a practical safety workflow:

- users can talk in groups in real time
- risky patterns can be detected as messages are sent
- Aurea Bot can respond early with warnings or support
- moderators can review alerts and reports with clearer context

## Key Features

### User Features

- Register and log in
- Create or join groups
- Real-time group chat
- Aurea Bot safety interventions
- Report users
- Mute users
- Safety Help support

### Admin Features

- Moderation dashboard
- Pending, high-risk, and reviewed alerts
- User reports
- Reports and analytics
- Suspend and unsuspend users
- Restrict and unrestrict users in groups
- Group management

## Aurea Bot

Aurea Bot is the central feature of the platform.

It helps by:

- detecting risky conversation patterns through backend safety rules
- sending warnings or supportive messages in chat
- creating admin alerts when moderation review is needed
- guiding users through Safety Help flows

Aurea Bot supports users and moderators, but it does not replace human moderation or safeguarding review.

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- SQLite for local development
- WebSockets
- Token-based authentication with JWT-style flow

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn-style UI components

## Folder Structure

- `src/`  
  Backend application code
- `src/routers/`  
  FastAPI route modules for auth, groups, messages, alerts, reports, and admin features
- `src/services/`  
  Detection, message processing, group services, and bot helper logic
- `src/ws/`  
  WebSocket chat routing and hub logic
- `frontend/src/app/`  
  Next.js app routes and pages
- `frontend/src/components/`  
  Shared UI, admin surfaces, chat components, and Safety Help widget
- `frontend/src/hooks/`  
  Frontend hooks such as current-user and WebSocket chat hooks
- `frontend/src/lib/`  
  API client, auth helpers, shared types, and utility modules
- `scripts/`  
  Local setup, reset, and maintenance scripts
- `tests/`  
  Smoke and moderation flow tests

## Important Files

### Backend

- `src/app.py`  
  FastAPI entry point, middleware, router registration, and startup schema checks
- `src/models.py`  
  SQLAlchemy models
- `src/schemas.py`  
  Pydantic schemas and API response models
- `src/db.py`  
  Database engine, session, and base setup
- `src/routers/auth_routes.py`  
  Authentication endpoints
- `src/routers/group_routes.py`  
  Group creation, membership, and group state routes
- `src/routers/message_routes.py`  
  Message and chat-related HTTP routes
- `src/routers/admin_routes.py`  
  Admin dashboard, moderation, and management routes
- `src/routers/report_routes.py`  
  User reporting routes
- `src/services/detect.py`  
  Rule-based safety detection patterns
- `src/services/messages_service.py`  
  Message processing, alert creation, strike tracking, and bot response flow
- `src/ws/chat.py`  
  WebSocket chat endpoint and real-time message handling

### Frontend

- `frontend/src/app/page.tsx`  
  Homepage
- `frontend/src/app/login/page.tsx`  
  Login page
- `frontend/src/app/register/page.tsx`  
  Register page
- `frontend/src/app/groups/page.tsx`  
  Group management page
- `frontend/src/app/chat/page.tsx`  
  Main group chat page
- `frontend/src/app/alerts/page.tsx`  
  Alerts page
- `frontend/src/app/admin/page.tsx`  
  Admin dashboard
- `frontend/src/app/admin/moderation/page.tsx`  
  Moderation center
- `frontend/src/app/admin/reports/page.tsx`  
  Reports and analytics
- `frontend/src/app/admin/users/page.tsx`  
  Admin user management
- `frontend/src/app/admin/groups/page.tsx`  
  Admin group management
- `frontend/src/hooks/use-ws-chat.ts`  
  Frontend WebSocket chat hook
- `frontend/src/lib/api.ts`  
  Shared API client
- `frontend/src/lib/auth.ts`  
  Frontend auth/session helpers
- `frontend/src/components/app-shell.tsx`  
  Main authenticated app shell and navigation
- `frontend/src/components/support-bot-widget.tsx`  
  Safety Help / Aurea Safety Help widget

## How the Safety Flow Works

User sends message  
→ WebSocket sends it to backend  
→ message is saved  
→ `detect.py` checks for risky patterns  
→ `messages_service.py` decides action  
→ alert is created if needed  
→ Aurea Bot responds  
→ admin can review alert

## Risk Detection

Aurea currently uses rule-based detection. It looks for explainable text patterns such as:

- age-related questions
- location and personal information requests
- secrecy language
- private photo or image pressure
- harassment and hate language
- violent threats
- self-harm distress or encouragement

This approach is explainable and easy to inspect, but it is still limited. It does not provide the depth or context handling of a production moderation system.

## Running the Project

### Backend

```bash
cd /path/to/aurea-platform
source ../.venv/bin/activate
python -m uvicorn src.app:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### URLs

- Backend health: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`
- Frontend: `http://localhost:3000`

## Development Checks

### Backend

```bash
python -m compileall src scripts tests
```

### Frontend

```bash
cd frontend
npx tsc --noEmit
```

## Demo Flow

- Log in
- Open or create a group
- Send a safe message
- Send a risky message
- Observe the Aurea Bot response
- Open admin moderation
- Review the alert
- Open Safety Help

## Limitations

- This is a prototype, not a production safeguarding platform
- Rule-based detection has clear limits
- False positives and false negatives are possible
- A real deployment would need stronger privacy controls, stronger security practices, trained moderators, and safeguarding review

## Future Improvements

- Better context-aware detection
- More automated and frontend test coverage
- Stronger privacy and account protection controls
- Better analytics and reporting depth
- Improved admin audit logging
- Mobile UX improvements
