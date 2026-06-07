// Typed API client for the StudySphere backend.
// Requests hit /api/* which Vite proxies to http://127.0.0.1:8000 in dev.

export type Mode = "online" | "offline";

export interface User {
  id: number;
  name: string;
  email: string;
  plan: string;
  credits: number;
}

export interface Plan {
  name: string;
  price: number;
  credits: number;
}

export interface AppConfig {
  ai_enabled: boolean;
  razorpay_enabled: boolean;
  signup_bonus: number;
  credit_costs: Record<string, number>;
  plans: Record<string, Plan>;
  curriculum: Record<string, string[]>;
}

export interface FileItem {
  id: number;
  name: string;
  file_type: string;
  semester: string | null;
  subject: string | null;
  doc_kind: string | null;
  char_count: number;
  chunk_count: number;
  upload_date: string;
}

export interface ChatChunk {
  text: string;
  page: number | null;
  source: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  chunks: ChatChunk[];
  used_ai: boolean;
  credits: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface TopicStat {
  topic: string;
  frequency: number;
  weight: number;
}

export interface HistoryItem {
  id: number;
  question: string;
  answer: string;
  sources: string[];
  mode: string;
  created_at: string;
}

export interface OrderInfo {
  mock: boolean;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string | null;
  plan: string;
  plan_name: string;
  credits: number;
}

// --- auth token (persisted) ------------------------------------------------ #
const TOKEN_KEY = "ss_token";
let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setAuthToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return token;
}

// HTTP 402 (out of credits) gets a typed error so the UI can prompt upgrade.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Called when any authenticated request returns 401 (token expired/invalid or
// the account no longer exists) so the app can cleanly return to the login screen.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", "Bearer " + token);
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      // FastAPI validation errors (422) return an array of {msg,...}; flatten
      // to a readable sentence instead of "[object Object]".
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((d: { msg?: string }) => d.msg || "Invalid input").join("; ");
      } else if (body.detail) {
        detail = body.detail;
      }
    } catch {
      /* ignore */
    }
    // A 401 on a normal endpoint means the session is no longer valid — drop it
    // and let the app show the login screen. (Login/signup 401s are real
    // "wrong credentials" errors and must NOT trigger a global logout.)
    const isAuthAttempt = path.includes("/auth/login") || path.includes("/auth/signup");
    if (res.status === 401 && !isAuthAttempt) {
      setAuthToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  // public
  config: () => request<AppConfig>("/api/config"),

  // auth
  signup: (name: string, email: string, password: string) =>
    postJson<{ token: string; user: User }>("/api/auth/signup", { name, email, password }),
  login: (email: string, password: string) =>
    postJson<{ token: string; user: User }>("/api/auth/login", { email, password }),
  me: () => request<User>("/api/auth/me"),
  stats: () =>
    request<{
      files: number;
      chunks: number;
      conversations: number;
      subjects: number;
      indexed_chunks: number;
      credits: number;
      plan: string;
    }>("/api/me/stats"),

  // files
  files: () =>
    request<{ files: FileItem[]; curriculum: Record<string, string[]> }>("/api/files"),
  upload: (form: FormData) =>
    request<{
      file_id: number;
      filename: string;
      status: string;
      chunks: number;
      char_count: number;
      text_preview: string;
    }>("/api/upload", { method: "POST", body: form }),
  deleteFile: (id: number) =>
    request<{ status: string }>(`/api/files/${id}`, { method: "DELETE" }),

  // ai (metered)
  chat: (question: string, file_id: number | null, mode: Mode) =>
    postJson<ChatResponse>("/api/chat", { question, file_id, mode }),
  history: () => request<{ history: HistoryItem[] }>("/api/history"),
  summarize: (file_id: number | null, mode: Mode) =>
    postJson<{ summary: string; used_ai: boolean; credits: number }>("/api/summarize", { file_id, mode }),
  quiz: (topic: string, count: number, file_id: number | null, mode: Mode) =>
    postJson<{ questions: QuizQuestion[]; used_ai: boolean; credits: number; message?: string }>(
      "/api/quiz",
      { topic, count, file_id, mode }
    ),
  paper: (subject: string, level: string, file_id: number | null, mode: Mode) =>
    postJson<{ paper: string; used_ai: boolean; credits: number }>("/api/question-paper", {
      subject,
      level,
      file_id,
      mode,
    }),
  plan: (days: number, subject: string, file_id: number | null, mode: Mode) =>
    postJson<{ plan: string; used_ai: boolean; credits: number }>("/api/revision-plan", {
      days,
      subject,
      file_id,
      mode,
    }),
  analyze: (file_id: number | null, mode: Mode) =>
    postJson<{ topics: TopicStat[]; insight?: string; used_ai: boolean; credits: number; message?: string }>(
      "/api/analyze-papers",
      { file_id, mode }
    ),

  // payments
  createOrder: (plan: string) => postJson<OrderInfo>("/api/payments/create-order", { plan }),
  verifyPayment: (body: {
    plan: string;
    order_id: string;
    payment_id?: string;
    signature?: string;
  }) =>
    postJson<{ status: string; plan: string; credits: number; added: number; mock: boolean }>(
      "/api/payments/verify",
      body
    ),
};
