import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  ClipboardCopy,
  Loader2,
  Mic,
  PersonStanding,
  Send,
  Square,
  Sparkles,
  UserRound,
  UserRoundCheck,
  Volume2,
} from "lucide-react";
import "./styles.css";

const API = "/api";

type Skill = {
  name: string;
  type: "required" | "preferred";
};

type Interview = {
  id: string;
  title: string;
  jd: string;
  skills: Skill[];
  created_at: string;
};

type Message = {
  role: "interviewer" | "candidate";
  content: string;
  created_at: string;
};

type Evaluation = {
  overall_match_score: number;
  required_skills: Record<string, number>;
  preferred_skills: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  evaluation_basis: string;
};

type Session = {
  id: string;
  interview_id: string;
  candidate_name: string;
  candidate_email: string;
  status: "in_progress" | "completed";
  messages: Message[];
  evaluation: Evaluation | null;
  created_at: string;
};

type VoiceMode = "female" | "male";

declare global {
  interface SpeechRecognitionResult {
    readonly [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
    readonly length: number;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
    readonly resultIndex: number;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    start(): void;
    stop(): void;
  }

  const SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };

  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (!body.detail && response.status >= 500) return mockRequest<T>(path, options);
      throw new Error(body.detail || "Request failed");
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError || String(error).includes("JSON")) {
      return mockRequest<T>(path, options);
    }
    throw error;
  }
}

const knownSkills = [
  "Node.js", "TypeScript", "JavaScript", "Python", "FastAPI", "React", "PostgreSQL",
  "MySQL", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD",
  "Microservices", "REST", "GraphQL", "Kafka", "MongoDB", "System Design",
];

const evidenceWords = ["built", "designed", "implemented", "optimized", "deployed", "scaled", "production", "users", "latency", "owned"];

function readStore() {
  return JSON.parse(localStorage.getItem("ai-hr-demo") || '{"interviews":[],"sessions":[]}') as {
    interviews: Interview[];
    sessions: Session[];
  };
}

function writeStore(store: ReturnType<typeof readStore>) {
  localStorage.setItem("ai-hr-demo", JSON.stringify(store));
}

function extractSkills(jd: string): Skill[] {
  const preferredIndex = ["preferred", "nice to have", "bonus"]
    .map((marker) => jd.toLowerCase().indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? jd.length + 1;
  const found = new Map<string, Skill>();

  for (const skill of knownSkills) {
    const index = jd.toLowerCase().indexOf(skill.toLowerCase());
    if (index >= 0) found.set(skill.toLowerCase(), { name: skill, type: index >= preferredIndex ? "preferred" : "required" });
  }

  for (const line of jd.split("\n")) {
    const match = line.match(/^\s*[-*]\s*([A-Za-z][A-Za-z0-9+#./\s-]{1,40})$/);
    if (!match) continue;
    const name = match[1].replace(/\s+/g, " ").trim();
    const index = jd.toLowerCase().indexOf(name.toLowerCase());
    found.set(name.toLowerCase(), { name, type: index >= preferredIndex ? "preferred" : "required" });
  }

  return [...found.values()].sort((a, b) => Number(a.type === "preferred") - Number(b.type === "preferred") || a.name.localeCompare(b.name));
}

function interviewerIntro(interview: Interview) {
  return `Hello. Thank you for applying for the ${interview.title} position. I am your HR screening interviewer for today. Before we go into the role requirements, please introduce yourself and walk me through your background in two or three minutes.`;
}

function skillQuestion(skill: Skill) {
  const name = skill.name.toLowerCase();
  if (name.includes("node")) {
    return "Let's go deeper on Node.js. In your most relevant backend project, how did you structure the service, handle errors, and keep APIs reliable under load?";
  }
  if (name.includes("postgres")) {
    return "I want to understand your PostgreSQL depth. Tell me about a schema or query performance problem you worked on. What was slow, how did you diagnose it, and what changed after your fix?";
  }
  if (name.includes("redis")) {
    return "Let's talk about Redis. Where have you used caching, queues, rate limiting, or session storage, and how did you avoid stale data or reliability issues?";
  }
  if (name.includes("docker")) {
    return "For Docker, walk me through how you containerized and deployed a service. What did your Dockerfile or compose setup look like, and what production issue did it help solve?";
  }
  if (name.includes("aws")) {
    return "You mentioned or the role prefers AWS. Which AWS services have you actually used, what did you own, and how comfortable are you operating them without step-by-step guidance?";
  }
  if (name.includes("kubernetes")) {
    return "For Kubernetes, what hands-on experience do you have with deployments, services, config, scaling, or debugging pods? Please separate what you owned from what your team owned.";
  }
  return `Let's validate ${skill.name}. Describe one real project where you used it, your exact responsibility, the hard part, and the measurable result.`;
}

function nextMockQuestion(session: Session, interview: Interview) {
  const candidateTurns = session.messages.filter((message) => message.role === "candidate").length;
  const latest = session.messages.filter((message) => message.role === "candidate").at(-1)?.content.toLowerCase() ?? "";
  const requiredSkills = interview.skills.filter((skill) => skill.type === "required");
  const preferredSkills = interview.skills.filter((skill) => skill.type === "preferred");
  const skillIndex = Math.max(0, candidateTurns - 3);
  const activeSkill = requiredSkills[skillIndex];

  if (candidateTurns === 1) {
    return "Thank you. What made you interested in this role, and why do you think your background is a good match for this job description?";
  }

  if (candidateTurns === 2) {
    return "Great. Now pick the one project that best proves your fit for this role. Please explain the business problem, your exact contribution, the team size, and the result.";
  }

  if (activeSkill && !/\b\d+[%a-zA-Z]*\b/.test(latest) && !/(scale|latency|production|tradeoff|impact|users|measured)/.test(latest)) {
    return `I need one more concrete detail on ${activeSkill.name}. What was the toughest decision or issue, what alternatives did you consider, and what evidence showed your approach worked?`;
  }

  const nextSkill = requiredSkills[skillIndex + 1];
  if (nextSkill) {
    return skillQuestion(nextSkill);
  }

  const preferredSkill = preferredSkills[skillIndex - requiredSkills.length + 1];
  if (preferredSkill) {
    return `This role also lists ${preferredSkill.name} as preferred. What exposure do you have there, and how independently could you work with it today?`;
  }

  if (candidateTurns < Math.max(7, requiredSkills.length + preferredSkills.length + 3)) {
    return "Now I would like to understand how you solve problems. Tell me about a production incident or difficult bug you handled. What signals did you check first, what was the root cause, and what did you change to prevent it from recurring?";
  }
  return "Thank you. Last question: is there any important evidence about your fit for this role that we have not covered yet?";
}

function evaluateSession(session: Session, interview: Interview): Evaluation {
  const transcript = session.messages.filter((message) => message.role === "candidate").map((message) => message.content).join("\n").toLowerCase();
  const scoreFor = (skill: Skill) => {
    const mentions = transcript.split(skill.name.toLowerCase()).length - 1;
    const evidence = evidenceWords.filter((word) => transcript.includes(word)).length;
    const numeric = (transcript.match(/\b\d+[%a-zA-Z]*\b/g) || []).length;
    return Math.min(100, Math.max(0, (mentions ? 30 : 10) + mentions * 14 + evidence * 3 + numeric * 2));
  };
  const required = Object.fromEntries(interview.skills.filter((skill) => skill.type === "required").map((skill) => [skill.name, scoreFor(skill)]));
  const preferred = Object.fromEntries(interview.skills.filter((skill) => skill.type === "preferred").map((skill) => [skill.name, scoreFor(skill)]));
  const requiredScores = Object.values(required).length ? Object.values(required) : [0];
  const preferredScores = Object.values(preferred);
  const overall = Math.round((requiredScores.reduce((a, b) => a + b, 0) / requiredScores.length) * 0.85 + (preferredScores.length ? preferredScores.reduce((a, b) => a + b, 0) / preferredScores.length : 65) * 0.15);

  const strengths = Object.entries({ ...required, ...preferred }).filter(([, score]) => score >= 75).slice(0, 3).map(([name]) => `Provided concrete evidence for ${name}.`);
  const weaknesses = Object.entries({ ...required, ...preferred }).filter(([, score]) => score < 60).slice(0, 3).map(([name]) => `Limited verified evidence for ${name}.`);

  return {
    overall_match_score: overall,
    required_skills: required,
    preferred_skills: preferred,
    strengths: strengths.length ? strengths : ["Shared relevant background, but evidence depth was limited."],
    weaknesses: weaknesses.length ? weaknesses : ["No major JD coverage gaps detected."],
    recommendation: overall >= 75 ? "Proceed to Technical Round" : overall >= 55 ? "Hold for Recruiter Review" : "Do Not Proceed",
    evaluation_basis: "Scores are based on transcript evidence tied to the job description, not accent, confidence, or speaking style.",
  };
}

async function mockRequest<T>(path: string, options?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const method = options?.method || "GET";
  const body = options?.body ? JSON.parse(String(options.body)) : {};
  const store = readStore();
  const now = new Date().toISOString();

  if (path === "/interviews" && method === "GET") return store.interviews as T;
  if (path === "/interviews" && method === "POST") {
    const interview: Interview = { id: crypto.randomUUID().slice(0, 8), title: body.title, jd: body.jd, skills: extractSkills(body.jd), created_at: now };
    store.interviews.unshift(interview);
    writeStore(store);
    return interview as T;
  }

  const interviewMatch = path.match(/^\/interviews\/([^/]+)$/);
  if (interviewMatch) {
    const interview = store.interviews.find((item) => item.id === interviewMatch[1]);
    if (!interview) throw new Error("Interview not found");
    return interview as T;
  }

  const sessionCreateMatch = path.match(/^\/interviews\/([^/]+)\/sessions$/);
  if (sessionCreateMatch && method === "POST") {
    const interview = store.interviews.find((item) => item.id === sessionCreateMatch[1]);
    if (!interview) throw new Error("Interview not found");
    const session: Session = {
      id: crypto.randomUUID().slice(0, 10),
      interview_id: interview.id,
      candidate_name: body.name,
      candidate_email: body.email,
      status: "in_progress",
      messages: [{ role: "interviewer", content: interviewerIntro(interview), created_at: now }],
      evaluation: null,
      created_at: now,
    };
    store.sessions.unshift(session);
    writeStore(store);
    return session as T;
  }

  const resultsMatch = path.match(/^\/interviews\/([^/]+)\/results$/);
  if (resultsMatch) return store.sessions.filter((session) => session.interview_id === resultsMatch[1] && session.status === "completed") as T;

  const messageMatch = path.match(/^\/sessions\/([^/]+)\/messages$/);
  if (messageMatch && method === "POST") {
    const session = store.sessions.find((item) => item.id === messageMatch[1]);
    if (!session) throw new Error("Session not found");
    const interview = store.interviews.find((item) => item.id === session.interview_id)!;
    session.messages.push({ role: "candidate", content: body.content, created_at: now });
    session.messages.push({ role: "interviewer", content: nextMockQuestion(session, interview), created_at: new Date().toISOString() });
    writeStore(store);
    return session as T;
  }

  const completeMatch = path.match(/^\/sessions\/([^/]+)\/complete$/);
  if (completeMatch && method === "POST") {
    const session = store.sessions.find((item) => item.id === completeMatch[1]);
    if (!session) throw new Error("Session not found");
    const interview = store.interviews.find((item) => item.id === session.interview_id)!;
    session.status = "completed";
    session.evaluation = evaluateSession(session, interview);
    writeStore(store);
    return session as T;
  }

  throw new Error(`Unsupported demo API route: ${method} ${path}`);
}

function App() {
  const interviewId = location.pathname.match(/^\/interview\/([^/]+)/)?.[1];
  return interviewId ? <CandidateInterview interviewId={interviewId} /> : <RecruiterDashboard />;
}

function RecruiterDashboard() {
  const [title, setTitle] = useState("Backend Engineer");
  const [jd, setJd] = useState(`Requirements:
- Node.js
- PostgreSQL
- Redis
- Docker

Preferred:
- AWS
- Kubernetes

Responsibilities:
Build reliable backend services, optimize database performance, and operate production systems.`);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [results, setResults] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const active = interviews.find((interview) => interview.id === activeId) ?? interviews[0];
  const shareLink = active ? `${location.origin}/interview/${active.id}` : "";

  useEffect(() => {
    request<Interview[]>("/interviews").then((items) => {
      setInterviews(items);
      setActiveId(items[0]?.id ?? null);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active?.id) return;
    request<Session[]>(`/interviews/${active.id}/results`).then(setResults).catch(() => setResults([]));
  }, [active?.id]);

  async function createInterview(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const interview = await request<Interview>("/interviews", {
        method: "POST",
        body: JSON.stringify({ title, jd }),
      });
      setInterviews((items) => [interview, ...items]);
      setActiveId(interview.id);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create interview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9f4] text-ink">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-fern text-white">
              <BriefcaseBusiness size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI HR Interviewer</h1>
              <p className="text-sm text-ink/60">JD-grounded first-round screening</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-ink/60 sm:flex">
            <BarChart3 size={17} />
            Evaluates evidence, not speaking style
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={createInterview} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="mb-5">
            <h2 className="text-base font-semibold">Create Interview</h2>
            <p className="mt-1 text-sm text-ink/60">Paste a JD and generate a candidate screening link.</p>
          </div>

          <label className="text-sm font-medium" htmlFor="title">Job title</label>
          <input
            id="title"
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none transition focus:border-fern"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="jd">Job description</label>
          <textarea
            id="jd"
            className="mt-2 h-80 w-full resize-none rounded-md border border-ink/15 px-3 py-2 font-mono text-sm outline-none transition focus:border-fern"
            value={jd}
            onChange={(event) => setJd(event.target.value)}
          />

          {error && <p className="mt-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-fern px-4 py-2.5 font-medium text-white transition hover:bg-fern/90 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            Generate Interview
          </button>
        </form>

        <div className="space-y-5">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Interview Configuration</h2>
                <p className="mt-1 text-sm text-ink/60">
                  {active ? active.title : "Create an interview to see extracted skills."}
                </p>
              </div>
              {active && (
                <select
                  className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                  value={active.id}
                  onChange={(event) => setActiveId(event.target.value)}
                >
                  {interviews.map((interview) => (
                    <option key={interview.id} value={interview.id}>{interview.title} - {interview.id}</option>
                  ))}
                </select>
              )}
            </div>

            {active ? (
              <>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <SkillColumn title="Required Skills" skills={active.skills.filter((skill) => skill.type === "required")} />
                  <SkillColumn title="Preferred Skills" skills={active.skills.filter((skill) => skill.type === "preferred")} />
                </div>

                <div className="mt-5 rounded-md border border-ink/10 bg-mist p-3">
                  <p className="mb-2 text-sm font-medium">Shareable candidate link</p>
                  <div className="flex gap-2">
                    <input className="min-w-0 flex-1 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm" readOnly value={shareLink} />
                    <button
                      type="button"
                      title="Copy interview link"
                      className="grid size-10 place-items-center rounded-md bg-ink text-white"
                      onClick={() => navigator.clipboard.writeText(shareLink)}
                    >
                      <ClipboardCopy size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="No interviews yet." />
            )}
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Candidate Results</h2>
              <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium">{results.length} completed</span>
            </div>
            {results.length ? (
              <div className="grid gap-3">
                {results.map((session) => (
                  <ResultCard key={session.id} session={session} />
                ))}
              </div>
            ) : (
              <EmptyState text="Completed candidate reports will appear here." />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function SkillColumn({ title, skills }: { title: string; skills: Skill[] }) {
  return (
    <div className="rounded-md border border-ink/10 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {skills.length ? skills.map((skill) => (
          <span key={skill.name} className="rounded-full bg-fern/10 px-3 py-1 text-sm text-fern">{skill.name}</span>
        )) : <span className="text-sm text-ink/45">None extracted</span>}
      </div>
    </div>
  );
}

function ResultCard({ session }: { session: Session }) {
  const evaluation = session.evaluation;
  if (!evaluation) return null;

  return (
    <article className="rounded-lg border border-ink/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{session.candidate_name}</h3>
          <p className="text-sm text-ink/60">{session.candidate_email}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold text-fern">{evaluation.overall_match_score}%</p>
          <p className="text-sm text-ink/60">{evaluation.recommendation}</p>
        </div>
      </div>
      <ScoreBars scores={{ ...evaluation.required_skills, ...evaluation.preferred_skills }} />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReportList title="Strengths" items={evaluation.strengths} />
        <ReportList title="Weaknesses" items={evaluation.weaknesses} />
      </div>
    </article>
  );
}

function pickVoice(voices: SpeechSynthesisVoice[], mode: VoiceMode) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const preferred = mode === "female"
    ? ["samantha", "victoria", "zira", "female", "google us english"]
    : ["daniel", "alex", "david", "mark", "male", "google uk english male"];

  return (
    preferred
      .map((hint) => englishVoices.find((voice) => voice.name.toLowerCase().includes(hint)))
      .find(Boolean)
    ?? englishVoices[0]
    ?? voices[0]
    ?? null
  );
}

function VoiceSwitch({ value, onChange }: { value: VoiceMode; onChange: (value: VoiceMode) => void }) {
  return (
    <div className="inline-grid grid-cols-2 rounded-md border border-ink/15 bg-white p-1">
      <button
        type="button"
        className={`inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition ${value === "female" ? "bg-rose text-white" : "text-ink/65 hover:bg-ink/5"}`}
        onClick={() => onChange("female")}
      >
        <UserRoundCheck size={15} />
        Female
      </button>
      <button
        type="button"
        className={`inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition ${value === "male" ? "bg-ink text-white" : "text-ink/65 hover:bg-ink/5"}`}
        onClick={() => onChange("male")}
      >
        <PersonStanding size={15} />
        Male
      </button>
    </div>
  );
}

function CandidateInterview({ interviewId }: { interviewId: string }) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answer, setAnswer] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("female");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const recognition = useMemo(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;
    const instance = new SpeechRecognitionCtor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";
    return instance;
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    request<Interview>(`/interviews/${interviewId}`).then(setInterview).catch((err) => setError(err.message));
  }, [interviewId]);

  useEffect(() => {
    const last = session?.messages.at(-1);
    if (last?.role === "interviewer") speak(last.content);
  }, [session?.messages.length]);

  async function startSession(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await request<Session>(`/interviews/${interviewId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      setSession(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start interview");
    } finally {
      setBusy(false);
    }
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickVoice(voices, voiceMode);
    utterance.rate = voiceMode === "female" ? 0.92 : 0.88;
    utterance.pitch = voiceMode === "female" ? 1.08 : 0.82;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function listen() {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    const base = answer.trim();
    setListening(true);
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      const parts = [base, finalText, interimText].map((part) => part.trim()).filter(Boolean);
      setAnswer(parts.join(" "));
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  async function sendAnswer(event: FormEvent) {
    event.preventDefault();
    if (!session || !answer.trim()) return;
    setBusy(true);
    try {
      const updated = await request<Session>(`/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: answer }),
      });
      setSession(updated);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send answer");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!session) return;
    setBusy(true);
    const completed = await request<Session>(`/sessions/${session.id}/complete`, { method: "POST" });
    setSession(completed);
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#eef2ef] text-ink">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="mb-6 flex items-center gap-3">
            <div className={`grid size-11 place-items-center rounded-md text-white ${voiceMode === "female" ? "bg-rose" : "bg-ink"}`}><UserRound size={21} /></div>
            <div>
              <h1 className="font-semibold">{interview?.title ?? "Interview"}</h1>
              <p className="text-sm text-ink/60">{voiceMode === "female" ? "Anika" : "Rahul"} · HR screening</p>
            </div>
          </div>
          <div className="mb-5">
            <p className="mb-2 text-sm font-medium">Interviewer voice</p>
            <VoiceSwitch value={voiceMode} onChange={setVoiceMode} />
          </div>
          {interview && <SkillColumn title="JD Coverage Areas" skills={interview.skills} />}
          <div className="mt-5 rounded-md border border-fern/15 bg-fern/5 p-4">
            <p className="text-sm font-medium text-fern">Evaluation basis</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Skill evidence, experience relevance, problem solving, technical knowledge, and JD coverage.
            </p>
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
          {!session ? (
            <form onSubmit={startSession} className="grid min-h-[720px] lg:grid-cols-[1fr_360px]">
              <div className="flex flex-col justify-between bg-[linear-gradient(145deg,#12372a,#1d4f40_55%,#d88962)] p-8 text-white">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-md bg-white/15 backdrop-blur">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Initial screening</p>
                    <h2 className="text-2xl font-semibold">{interview?.title ?? "Candidate Interview"}</h2>
                  </div>
                </div>
                <div className="max-w-2xl py-12">
                  <p className="text-sm uppercase tracking-[0.18em] text-white/60">{voiceMode === "female" ? "Anika" : "Rahul"} will begin with</p>
                  <p className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                    Please introduce yourself and walk me through your background.
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-white/75 sm:grid-cols-3">
                  <span className="rounded-md bg-white/10 px-3 py-2">Experience fit</span>
                  <span className="rounded-md bg-white/10 px-3 py-2">Skill evidence</span>
                  <span className="rounded-md bg-white/10 px-3 py-2">Problem solving</span>
                </div>
              </div>
              <div className="flex flex-col justify-center p-6">
                <h2 className="text-xl font-semibold">Join Interview</h2>
                <p className="mt-2 text-sm text-ink/60">Enter your details to begin the screening call.</p>
                <label className="mt-6 text-sm font-medium" htmlFor="name">Name</label>
                <input id="name" className="mt-2 rounded-md border border-ink/15 px-3 py-2.5 outline-none focus:border-fern" value={name} onChange={(event) => setName(event.target.value)} required />
                <label className="mt-4 text-sm font-medium" htmlFor="email">Email</label>
                <input id="email" type="email" className="mt-2 rounded-md border border-ink/15 px-3 py-2.5 outline-none focus:border-fern" value={email} onChange={(event) => setEmail(event.target.value)} required />
                {error && <p className="mt-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
                <button className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-fern px-4 py-3 font-medium text-white disabled:opacity-60" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />}
                  Start Interview
                </button>
              </div>
            </form>
          ) : session.status === "completed" && session.evaluation ? (
            <CompletionReport session={session} />
          ) : (
            <div className="flex h-full min-h-[720px] flex-col">
              <div className="flex flex-col gap-4 border-b border-ink/10 bg-[#fbfcfa] p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`grid size-12 place-items-center rounded-md text-white ${voiceMode === "female" ? "bg-rose" : "bg-ink"}`}>
                    <UserRound size={22} />
                  </div>
                  <div>
                    <h2 className="font-semibold">{voiceMode === "female" ? "Anika" : "Rahul"} is interviewing {session.candidate_name}</h2>
                    <p className="text-sm text-ink/60">Live HR screening · {interview?.title}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <VoiceSwitch value={voiceMode} onChange={setVoiceMode} />
                  <button type="button" className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm" onClick={() => speak(session.messages.at(-1)?.content ?? "")}>
                    <Volume2 size={16} />
                    Replay
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#f6f8f5] p-5">
                {session.messages.map((message, index) => (
                  <div key={`${message.created_at}-${index}`} className={`flex ${message.role === "candidate" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "candidate" ? "border-fern bg-fern text-white" : "border-ink/10 bg-white text-ink"}`}>
                      <p className="mb-1 text-xs font-medium opacity-70">{message.role === "candidate" ? session.candidate_name : voiceMode === "female" ? "Anika" : "Rahul"}</p>
                      <p>{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={sendAnswer} className="border-t border-ink/10 bg-white p-5">
                <textarea
                  className="h-28 w-full resize-none rounded-md border border-ink/15 bg-[#fbfcfa] px-3 py-2 outline-none focus:border-fern"
                  placeholder="Answer here, or use the microphone."
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" title={recognition ? "Record answer" : "Speech recognition unavailable"} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium disabled:opacity-50 ${listening ? "bg-coral text-white" : "border border-ink/15 text-ink"}`} disabled={!recognition} onClick={listen}>
                    {listening ? <Square size={17} /> : <Mic size={17} />}
                    {listening ? "Stop" : "Record"}
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-md bg-fern px-4 py-2 font-medium text-white disabled:opacity-60" disabled={busy || !answer.trim()}>
                    {busy ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                    Send
                  </button>
                  <button type="button" className="ml-auto rounded-md border border-ink/15 px-4 py-2 text-sm" onClick={complete} disabled={busy || session.messages.filter((message) => message.role === "candidate").length < 2}>
                    Submit Interview
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function CompletionReport({ session }: { session: Session }) {
  const evaluation = session.evaluation!;
  return (
    <div className="mx-auto max-w-3xl py-8">
      <p className="text-sm font-medium text-fern">Interview submitted</p>
      <h2 className="mt-2 text-2xl font-semibold">Thank you, {session.candidate_name}</h2>
      <p className="mt-2 text-ink/60">Your screening report has been generated for the recruiter.</p>
      <div className="mt-6 rounded-lg border border-ink/10 p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">Overall Match Score</span>
          <span className="text-3xl font-semibold text-fern">{evaluation.overall_match_score}%</span>
        </div>
        <ScoreBars scores={{ ...evaluation.required_skills, ...evaluation.preferred_skills }} />
        <p className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-ink/70">{evaluation.evaluation_basis}</p>
      </div>
    </div>
  );
}

function ScoreBars({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="mt-4 space-y-2">
      {Object.entries(scores).map(([skill, score]) => (
        <div key={skill} className="grid grid-cols-[120px_1fr_44px] items-center gap-3 text-sm">
          <span className="truncate text-ink/70">{skill}</span>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-coral" style={{ width: `${score}%` }} />
          </div>
          <span className="text-right font-medium">{score}%</span>
        </div>
      ))}
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-ink/65">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-ink/20 px-4 py-8 text-center text-sm text-ink/50">{text}</div>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
