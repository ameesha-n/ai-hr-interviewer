from __future__ import annotations

from datetime import datetime, timezone
import re
import uuid
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field


app = FastAPI(title="AI HR Interviewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SkillType = Literal["required", "preferred"]
SessionStatus = Literal["in_progress", "completed"]
MessageRole = Literal["interviewer", "candidate"]


class InterviewCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    jd: str = Field(min_length=20)


class CandidateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr


class CandidateMessage(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class Skill(BaseModel):
    name: str
    type: SkillType


class Message(BaseModel):
    role: MessageRole
    content: str
    created_at: str


class Interview(BaseModel):
    id: str
    title: str
    jd: str
    skills: list[Skill]
    created_at: str


class Session(BaseModel):
    id: str
    interview_id: str
    candidate_name: str
    candidate_email: EmailStr
    status: SessionStatus
    messages: list[Message]
    asked_skill_ids: list[str]
    current_skill: str | None = None
    evaluation: dict | None = None
    created_at: str


KNOWN_SKILLS = [
    "Node.js",
    "TypeScript",
    "JavaScript",
    "Python",
    "FastAPI",
    "React",
    "PostgreSQL",
    "MySQL",
    "Redis",
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "Azure",
    "CI/CD",
    "Microservices",
    "REST",
    "GraphQL",
    "Kafka",
    "RabbitMQ",
    "MongoDB",
    "Django",
    "Flask",
    "Security",
    "Testing",
    "System Design",
]

EVIDENCE_WORDS = {
    "built",
    "designed",
    "implemented",
    "optimized",
    "debugged",
    "deployed",
    "scaled",
    "migrated",
    "owned",
    "led",
    "measured",
    "reduced",
    "increased",
    "production",
    "users",
    "latency",
    "throughput",
}

interviews: dict[str, Interview] = {}
sessions: dict[str, Session] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def extract_skills(jd: str) -> list[Skill]:
    lower_jd = jd.lower()
    preferred_start = min(
        [idx for marker in ("preferred", "nice to have", "bonus") if (idx := lower_jd.find(marker)) >= 0],
        default=len(jd) + 1,
    )
    found: dict[str, Skill] = {}

    for skill in KNOWN_SKILLS:
        pattern = re.escape(skill).replace("\\.", r"\.?")
        match = re.search(rf"\b{pattern}\b", jd, flags=re.IGNORECASE)
        if match:
            skill_type: SkillType = "preferred" if match.start() >= preferred_start else "required"
            found[skill.lower()] = Skill(name=skill, type=skill_type)

    bullet_skills = re.findall(r"^\s*[-*]\s*([A-Za-z][A-Za-z0-9+#./\s-]{1,40})$", jd, flags=re.MULTILINE)
    for item in bullet_skills:
        cleaned = re.sub(r"\s+", " ", item).strip(" .")
        if 2 <= len(cleaned) <= 35:
            idx = jd.lower().find(item.lower())
            skill_type = "preferred" if idx >= preferred_start else "required"
            found.setdefault(cleaned.lower(), Skill(name=cleaned, type=skill_type))

    return sorted(found.values(), key=lambda skill: (skill.type != "required", skill.name.lower()))


def first_question(interview: Interview) -> str:
    return (
        f"Hello. Thank you for applying for the {interview.title} position. "
        "I am your HR screening interviewer for today. Before we go into the role requirements, "
        "please introduce yourself and walk me through your background in two or three minutes."
    )


def next_question_for(session: Session, interview: Interview) -> str:
    candidate_turns = [message.content for message in session.messages if message.role == "candidate"]
    latest = candidate_turns[-1] if candidate_turns else ""
    latest_lower = latest.lower()
    turn_count = len(candidate_turns)

    if turn_count == 1:
        return (
            "Thank you. What made you interested in this role, and which project from your recent "
            "experience is most relevant to this job description?"
        )

    active_skill = next((skill for skill in interview.skills if skill.name == session.current_skill), None)
    has_evidence = any(
        word in latest_lower
        for word in ("users", "scale", "latency", "production", "tradeoff", "why", "how", "measured", "impact")
    ) or bool(re.search(r"\b\d+[%a-zA-Z]*\b", latest_lower))
    if active_skill and has_evidence:
        session.asked_skill_ids.append(slug(active_skill.name))
        session.current_skill = None

    unasked = [skill for skill in interview.skills if slug(skill.name) not in session.asked_skill_ids]
    if active_skill and slug(active_skill.name) not in session.asked_skill_ids:
        return (
            f"Thanks. I want to validate that {active_skill.name} experience a little more. "
            "What was the hardest decision you made, what tradeoffs did you consider, and how did you know the solution worked?"
        )

    if unasked:
        skill = unasked[0]
        session.current_skill = skill.name
        return (
            f"I see {skill.name} is important for this role. Please describe a real project where you used it. "
            "I am looking for your role, the problem, the implementation choices, and the business or technical outcome."
        )

    if len(candidate_turns) < max(5, len(interview.skills) + 1):
        return (
            "Now I would like to understand your problem-solving style. Tell me about a production issue or difficult bug "
            "you handled. How did you investigate it, what did you try first, and what was the final outcome?"
        )

    return (
        "Thank you. I have enough information for this initial screening round. "
        "Is there anything important about your fit for this role that we have not covered yet?"
    )


def score_skill(skill: Skill, transcript: str) -> int:
    transcript_lower = transcript.lower()
    mentions = len(re.findall(re.escape(skill.name.lower()), transcript_lower))
    evidence = sum(1 for word in EVIDENCE_WORDS if word in transcript_lower)
    numeric_evidence = len(re.findall(r"\b\d+[%a-zA-Z]*\b", transcript_lower))
    base = 30 if mentions else 10
    score = base + min(35, mentions * 14) + min(25, evidence * 3) + min(10, numeric_evidence * 2)
    if skill.type == "preferred" and mentions == 0:
        score = min(score, 40)
    return max(0, min(100, score))


def build_evaluation(session: Session, interview: Interview) -> dict:
    transcript = "\n".join(message.content for message in session.messages if message.role == "candidate")
    required = [skill for skill in interview.skills if skill.type == "required"]
    preferred = [skill for skill in interview.skills if skill.type == "preferred"]
    skill_scores = {skill.name: score_skill(skill, transcript) for skill in interview.skills}
    required_scores = [skill_scores[skill.name] for skill in required] or list(skill_scores.values()) or [0]
    preferred_scores = [skill_scores[skill.name] for skill in preferred]
    overall = round((sum(required_scores) / len(required_scores)) * 0.85 + ((sum(preferred_scores) / len(preferred_scores)) if preferred_scores else 65) * 0.15)

    strong = [name for name, score in skill_scores.items() if score >= 75]
    weak = [name for name, score in skill_scores.items() if score < 60]
    recommendation = "Proceed to Technical Round" if overall >= 75 else "Hold for Recruiter Review" if overall >= 55 else "Do Not Proceed"

    return {
        "overall_match_score": overall,
        "required_skills": {skill.name: skill_scores[skill.name] for skill in required},
        "preferred_skills": {skill.name: skill_scores[skill.name] for skill in preferred},
        "strengths": [
            f"Provided concrete evidence for {name}." for name in strong[:3]
        ]
        or ["Shared relevant background, but evidence depth was limited."],
        "weaknesses": [
            f"Limited verified evidence for {name}." for name in weak[:3]
        ]
        or ["No major JD coverage gaps detected in this first-round screen."],
        "recommendation": recommendation,
        "evaluation_basis": "Scores are based on transcript evidence tied to the job description, not accent, confidence, or speaking style.",
    }


@app.get("/")
def root():
    return {"status": "running", "service": "AI HR Interviewer API"}


@app.post("/interviews", response_model=Interview)
def create_interview(data: InterviewCreate):
    interview_id = uuid.uuid4().hex[:8]
    interview = Interview(
        id=interview_id,
        title=data.title.strip(),
        jd=data.jd.strip(),
        skills=extract_skills(data.jd),
        created_at=now_iso(),
    )
    interviews[interview_id] = interview
    return interview


@app.get("/interviews", response_model=list[Interview])
def list_interviews():
    return sorted(interviews.values(), key=lambda item: item.created_at, reverse=True)


@app.get("/interviews/{interview_id}", response_model=Interview)
def get_interview(interview_id: str):
    interview = interviews.get(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@app.post("/interviews/{interview_id}/sessions", response_model=Session)
def create_session(interview_id: str, candidate: CandidateCreate):
    interview = interviews.get(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    session_id = uuid.uuid4().hex[:10]
    session = Session(
        id=session_id,
        interview_id=interview_id,
        candidate_name=candidate.name.strip(),
        candidate_email=candidate.email,
        status="in_progress",
        messages=[
            Message(role="interviewer", content=first_question(interview), created_at=now_iso())
        ],
        asked_skill_ids=[],
        created_at=now_iso(),
    )
    sessions[session_id] = session
    return session


@app.get("/sessions/{session_id}", response_model=Session)
def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.post("/sessions/{session_id}/messages", response_model=Session)
def add_candidate_message(session_id: str, message: CandidateMessage):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Session already completed")

    interview = interviews[session.interview_id]
    session.messages.append(Message(role="candidate", content=message.content.strip(), created_at=now_iso()))
    session.messages.append(Message(role="interviewer", content=next_question_for(session, interview), created_at=now_iso()))
    return session


@app.post("/sessions/{session_id}/complete", response_model=Session)
def complete_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    interview = interviews[session.interview_id]
    session.status = "completed"
    session.evaluation = build_evaluation(session, interview)
    return session


@app.get("/interviews/{interview_id}/results", response_model=list[Session])
def get_results(interview_id: str):
    if interview_id not in interviews:
        raise HTTPException(status_code=404, detail="Interview not found")
    return [
        session
        for session in sessions.values()
        if session.interview_id == interview_id and session.status == "completed"
    ]
