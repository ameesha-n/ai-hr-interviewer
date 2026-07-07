# HireFlow AI
### Autonomous AI Recruiter for First-Round Candidate Screening

> **HireFlow AI** is an AI-powered recruitment platform that automates the first round of HR interviews for companies. Recruiters create hiring campaigns, upload job descriptions, and share interview links with candidates. The AI conducts adaptive interviews, evaluates responses, and generates recruiter-ready reports to streamline candidate screening.

---

## ✨ Why HireFlow AI?

Hiring teams often spend countless hours conducting repetitive first-round screening interviews.

HireFlow AI acts as an **AI HR Recruiter**, capable of:

- Understanding Job Descriptions
- Understanding Candidate Resumes
- Conducting Natural Interviews
- Asking Adaptive Follow-up Questions
- Evaluating Candidate Responses
- Generating Structured Hiring Reports

Instead of replacing recruiters, HireFlow AI helps them focus on high-value conversations by automating repetitive screening interviews.

---

# 🚀 Features

## 👨‍💼 Recruiter Portal

- Recruiter Authentication
- Create Hiring Campaigns
- Create Job Openings
- Upload Job Descriptions
- Generate Interview Links
- Candidate Dashboard
- Candidate Reports
- Analytics Dashboard

---

## 👤 Candidate Portal

- Resume Upload
- Camera & Microphone Check
- AI Interview Experience
- Voice-Based Conversation
- Live Transcript
- Interview Progress Tracking
- Completion Screen

---

## 🤖 AI Recruiter

The AI interviewer is capable of:

- Resume Understanding
- Job Description Analysis
- Interview Planning
- Context-Aware Question Generation
- Adaptive Follow-up Questions
- Conversation Memory
- Candidate Evaluation
- Recruiter Report Generation

---

# 🧠 AI Interview Flow

```text
Recruiter
      │
      ▼
Create Job Opening
      │
      ▼
Upload Job Description
      │
      ▼
Generate Interview Link
      │
      ▼
Candidate Opens Link
      │
      ▼
Upload Resume
      │
      ▼
Resume + JD Analysis
      │
      ▼
Interview Plan Generation
      │
      ▼
Adaptive AI Interview
      │
      ▼
Evaluation Engine
      │
      ▼
Recruiter Dashboard
```

---

# 🏗 Architecture

```text
                        Frontend (React)

          Recruiter Dashboard      Candidate Portal
                     │                     │
                     └──────────┬──────────┘
                                │
                                ▼
                        FastAPI Backend
                                │
 ┌──────────────────────────────┼──────────────────────────────┐
 │                              │                              │
 ▼                              ▼                              ▼
 Authentication          Interview Engine              AI Orchestrator
 │                              │                              │
 ▼                              ▼                              ▼
 PostgreSQL              Conversation Memory         Gemini API
 │                              │                              │
 ▼                              ▼                              ▼
 Reports                  Candidate History          Resume/JD Analysis
```

---

# 🧩 System Components

## Authentication Service

- JWT Authentication
- Recruiter Accounts
- Protected APIs

---

## Job Management

- Create Jobs
- Manage Hiring Campaigns
- Generate Interview Links

---

## Candidate Service

- Resume Upload
- Candidate Profiles
- Interview Tracking

---

## Interview Engine

Responsible for:

- Interview State
- Conversation Memory
- Adaptive Question Flow
- Interview Completion

---

## AI Orchestrator

Coordinates:

- Resume Parsing
- Job Description Analysis
- Skill Matching
- Interview Planning
- Question Generation
- Follow-up Questions
- Candidate Evaluation
- Recruiter Report Generation

---

## Evaluation Engine

Evaluates:

- Technical Knowledge
- Communication
- Problem Solving
- Leadership
- Ownership
- Role Alignment
- Confidence

Produces:

- Candidate Summary
- Strengths
- Weaknesses
- Supporting Evidence
- Recommendation

---

# 🖥 Tech Stack

## Frontend

- React
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand
- TanStack Query

---

## Backend

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- JWT Authentication

---

## AI

- Google Gemini 2.5 Flash

Capabilities:

- Resume Understanding
- Interview Planning
- Adaptive Questioning
- Candidate Evaluation

---

## Speech

### Speech-to-Text

Browser Web Speech API

### Text-to-Speech

Browser SpeechSynthesis API

No paid voice APIs are required for the MVP.

---

## Deployment

Frontend

- Vercel / Cloudflare Pages

Backend

- Render

Database

- Neon PostgreSQL

Storage

- Cloudinary (Optional)

---

# 🎯 Interview Lifecycle

```text
Create Job
      │
      ▼
Upload JD
      │
      ▼
AI Generates Interview Plan
      │
      ▼
Candidate Uploads Resume
      │
      ▼
AI Reads Resume
      │
      ▼
Interview Begins
      │
      ▼
Adaptive Follow-up Questions
      │
      ▼
Interview Ends
      │
      ▼
Candidate Evaluation
      │
      ▼
Recruiter Report
```

---

# 📊 Recruiter Report

Each completed interview produces a structured report containing:

- Overall Recommendation
- Technical Assessment
- Communication Assessment
- Leadership Assessment
- Confidence Assessment
- Skill Match Analysis
- Key Strengths
- Areas for Improvement
- Evidence-Based Observations
- Suggested Next Round Questions

---

# 🎨 Design Philosophy

HireFlow AI follows a clean, enterprise-focused design inspired by:

- Linear
- Stripe Dashboard
- Notion
- Raycast
- Vercel

Design principles:

- Minimal
- Modern
- Accessible
- Dark-first
- High readability
- Smooth micro-interactions

---

# 🔮 Roadmap

## Phase 1

- Recruiter Dashboard
- Candidate Portal
- Resume Upload
- AI Interview
- Deployment

---

## Phase 2

- Adaptive Interview Planning
- Candidate Reports
- Hiring Analytics
- Candidate Ranking

---

## Phase 3

- Multi-company Support
- Custom AI Recruiters
- Coding Interviews
- Calendar Integration
- ATS Integration
- Email Notifications

---

# 💡 Future Enhancements

- Multi-language Interviews
- Live Video Interviews
- AI Avatar
- Real-time Recruiter Dashboard
- Coding Assessments
- Team Collaboration
- Interview Replay
- AI Hiring Insights

---

# 🤝 Contributing

Contributions are welcome!

If you'd like to improve HireFlow AI, feel free to open an issue or submit a pull request.

---

# 📜 License

MIT License

---

> **HireFlow AI** aims to redefine first-round hiring by giving every company access to an intelligent AI recruiter capable of conducting scalable, consistent, and evidence-based candidate interviews.
