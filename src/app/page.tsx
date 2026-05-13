"use client";

import {
  Bot,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type ProviderId = "openrouter" | "deepseek" | "lmstudio" | "ollama";

type Message = {
  id: string;
  role: string;
  content: string;
  metadata: string;
  createdAt: string;
};

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  purpose: string;
  path: string;
};

type Document = {
  id: string;
  kind: string;
  title: string;
  content: string;
};

type Session = {
  id: string;
  title: string;
  rawIntent: string;
  domain: string;
  targetUsers: string;
  constraints: string[];
  references: string[];
  mustHaveFeatures: string[];
  niceToHaveFeatures: string[];
  risks: string[];
  unknowns: string[];
  decisions: string[];
  outputType: string;
  completenessScore: number;
  messages: Message[];
  attachments: Attachment[];
  documents: Document[];
};

const providerLabels: Record<ProviderId, string> = {
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  lmstudio: "LM Studio",
  ollama: "Ollama",
};

const providerIds = Object.keys(providerLabels) as ProviderId[];

function isProviderId(value: string | null): value is ProviderId {
  return Boolean(value && providerIds.includes(value as ProviderId));
}

function getStoredProvider(): ProviderId {
  if (typeof window === "undefined") {
    return "openrouter";
  }

  const savedProvider = window.localStorage.getItem("refinegoals.provider");
  if (isProviderId(savedProvider)) {
    return savedProvider;
  }

  return "openrouter";
}

function subscribeProvider(callback: () => void) {
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("storage", callback);
  };
}

function useStoredProvider() {
  const provider = useSyncExternalStore<ProviderId>(
    subscribeProvider,
    getStoredProvider,
    () => "openrouter",
  );

  const setStoredProvider = (nextProvider: ProviderId) => {
    window.localStorage.setItem("refinegoals.provider", nextProvider);
    window.dispatchEvent(new StorageEvent("storage"));
  };

  return [provider, setStoredProvider] as const;
}

function metadataOf(message: Message) {
  try {
    return JSON.parse(message.metadata || "{}") as {
      providerUsed?: string;
      nextQuestions?: string[];
      suggestedArtifacts?: string[];
    };
  } catch {
    return {};
  }
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm">
      {children}
    </span>
  );
}

function ListBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [provider, setProvider] = useStoredProvider();
  const [useSearch, setUseSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => sessions.find((session) => session.id === activeId) || sessions[0],
    [sessions, activeId],
  );

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/sessions");
      const data = (await response.json()) as { sessions: Session[] };
      setSessions(data.sessions);
      setActiveId(data.sessions[0]?.id || "");
    }

    void load();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [active?.messages.length]);

  async function refreshSession(sessionId: string) {
    const response = await fetch(`/api/sessions/${sessionId}`);
    const data = (await response.json()) as { session: Session };
    setSessions((current) => {
      const exists = current.some((session) => session.id === data.session.id);
      if (!exists) {
        return [data.session, ...current];
      }

      return current.map((session) =>
        session.id === data.session.id ? data.session : session,
      );
    });
    setActiveId(data.session.id);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) {
      return;
    }

    setLoading(true);
    setInput("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: active?.id,
        message,
        provider,
        useSearch,
      }),
    });

    const data = (await response.json()) as { session: Session };
    setSessions((current) => {
      const exists = current.some((session) => session.id === data.session.id);
      if (!exists) {
        return [data.session, ...current];
      }

      return current.map((session) =>
        session.id === data.session.id ? data.session : session,
      );
    });
    setActiveId(data.session.id);
    setLoading(false);
  }

  async function createSession() {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "새 목표",
      }),
    });
    const data = (await response.json()) as { session: Session };
    setSessions((current) => [
      {
        ...data.session,
        messages: [],
        attachments: [],
        documents: [],
      },
      ...current,
    ]);
    setActiveId(data.session.id);
  }

  async function uploadFile(file: File) {
    if (!active) {
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("sessionId", active.id);
    form.append("purpose", "UI/design, product/function, mood/style reference");
    form.append("file", file);

    await fetch("/api/upload", {
      method: "POST",
      body: form,
    });
    await refreshSession(active.id);
    setUploading(false);
  }

  function downloadDocument(document: Document) {
    const blob = new Blob([document.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.kind}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const emptyState = !active || active.messages.length === 0;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_392px]">
        <aside className="hidden border-r border-slate-200 bg-slate-950 text-white lg:block">
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
                <Target size={19} />
              </div>
              <div>
                <h1 className="text-sm font-semibold">RefineGoals</h1>
                <p className="text-xs text-slate-400">Local MVP</p>
              </div>
            </div>
            <button
              aria-label="Create session"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10"
              onClick={createSession}
              type="button"
            >
              <MessageSquarePlus size={18} />
            </button>
          </div>

          <div className="space-y-2 p-3">
            {sessions.length === 0 ? (
              <button
                className="w-full rounded-md border border-white/10 px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/10"
                onClick={createSession}
                type="button"
              >
                첫 목표 세션 만들기
              </button>
            ) : (
              sessions.map((session) => (
                <button
                  className={`w-full rounded-md px-3 py-3 text-left transition ${
                    active?.id === session.id
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                  key={session.id}
                  onClick={() => setActiveId(session.id)}
                  type="button"
                >
                  <div className="line-clamp-1 text-sm font-semibold">
                    {session.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
                    <span>{session.domain}</span>
                    <span>{session.completenessScore}%</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-screen flex-col bg-white">
          <header className="flex min-h-16 items-center justify-between border-b border-slate-200 px-5">
            <div>
              <h2 className="text-base font-semibold">
                {active?.title || "목표 구체화"}
              </h2>
              <p className="text-sm text-slate-500">
                애매한 목표를 질문, 검색, 참고 이미지로 실행 가능한 설계로 압축합니다.
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Pill>{providerLabels[provider]}</Pill>
              <Pill>{useSearch ? "Tavily search on" : "Search off"}</Pill>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {emptyState ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-24 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
                  <Sparkles size={28} />
                </div>
                <h2 className="text-2xl font-semibold tracking-normal">
                  만들고 싶은 것을 편하게 던져주세요
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  예: “보안 연구자가 커널 드라이버 PoC를 빠르게 설계하는 도구를
                  만들고 싶어.” 참고 이미지를 올리면 UI, 기능, 분위기까지 함께
                  반영합니다.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {active.messages.map((message) => {
                  const meta = metadataOf(message);

                  return (
                    <div
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                      key={message.id}
                    >
                      <div
                        className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                          message.role === "user"
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-800"
                        }`}
                      >
                        {message.role !== "user" ? (
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <Bot size={15} />
                            <span>{meta.providerUsed || "assistant"}</span>
                          </div>
                        ) : null}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {meta.nextQuestions && meta.nextQuestions.length > 0 ? (
                          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                            {meta.nextQuestions.map((question) => (
                              <button
                                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-white"
                                key={question}
                                onClick={() => setInput(question)}
                                type="button"
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {loading ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      <Loader2 className="animate-spin" size={16} />
                      목표 상태를 갱신하는 중...
                    </div>
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form
            className="border-t border-slate-200 bg-white p-4"
            onSubmit={submit}
          >
            <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm">
              <textarea
                className="min-h-24 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-slate-400"
                onChange={(event) => setInput(event.target.value)}
                placeholder="목표, 참고한 제품, 만들고 싶은 산출물, 제약 조건을 적어주세요."
                value={input}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none"
                    onChange={(event) =>
                      setProvider(event.target.value as ProviderId)
                    }
                    value={provider}
                  >
                    {Object.entries(providerLabels).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium ${
                      useSearch
                        ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                    onClick={() => setUseSearch((value) => !value)}
                    type="button"
                  >
                    <Search size={15} />
                    Tavily
                  </button>
                  <button
                    className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                    disabled={!active || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <ImagePlus size={15} />
                    {uploading ? "업로드 중" : "이미지"}
                  </button>
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void uploadFile(file);
                      }
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
                <button
                  className="ml-auto flex h-9 min-w-28 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading || !input.trim()}
                  type="submit"
                >
                  <Send size={15} />
                  보내기
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="hidden border-l border-slate-200 bg-slate-50 xl:block">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
            <div className="flex items-center gap-2">
              <Settings2 size={18} />
              <h2 className="text-sm font-semibold">Goal Dashboard</h2>
            </div>
            <div className="text-sm font-semibold text-cyan-700">
              {active?.completenessScore || 0}%
            </div>
          </div>

          <div className="h-[calc(100vh-4rem)] overflow-y-auto p-5">
            {!active ? (
              <p className="text-sm text-slate-500">
                목표 세션을 만들면 대시보드가 여기에 표시됩니다.
              </p>
            ) : (
              <div className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold">{active.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {active.rawIntent || "아직 원본 목표가 없습니다."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill>{active.domain}</Pill>
                    <Pill>{active.outputType}</Pill>
                  </div>
                </section>

                <ListBlock
                  empty="아직 확정된 결정사항이 없습니다."
                  items={active.decisions}
                  title="Decisions"
                />
                <ListBlock
                  empty="필수 기능이 아직 비어 있습니다."
                  items={active.mustHaveFeatures}
                  title="Must Have"
                />
                <ListBlock
                  empty="추가 기능 후보가 없습니다."
                  items={active.niceToHaveFeatures}
                  title="Nice To Have"
                />
                <ListBlock
                  empty="확인할 질문이 없습니다."
                  items={active.unknowns}
                  title="Unknowns"
                />
                <ListBlock
                  empty="운영 리스크가 아직 정리되지 않았습니다."
                  items={active.risks}
                  title="Risks"
                />

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                    References
                  </h3>
                  {active.attachments.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-400">
                      참고 이미지가 없습니다.
                    </p>
                  ) : (
                    active.attachments.map((attachment) => (
                      <div
                        className="rounded-md border border-slate-200 bg-white px-3 py-2"
                        key={attachment.id}
                      >
                        <div className="text-sm font-medium text-slate-700">
                          {attachment.fileName}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {attachment.purpose}
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="space-y-2 pb-6">
                  <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                    Dashboard Documents
                  </h3>
                  {active.documents.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-400">
                      첫 대화를 보내면 Markdown 산출물이 생성됩니다.
                    </p>
                  ) : (
                    active.documents.map((document) => (
                      <div
                        className="rounded-lg border border-slate-200 bg-white p-3"
                        key={document.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText
                              className="shrink-0 text-slate-400"
                              size={17}
                            />
                            <span className="truncate text-sm font-semibold">
                              {document.title}
                            </span>
                          </div>
                          <button
                            aria-label={`Download ${document.title}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                            onClick={() => downloadDocument(document)}
                            type="button"
                          >
                            <Download size={15} />
                          </button>
                        </div>
                        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                          {document.content}
                        </pre>
                      </div>
                    ))
                  )}
                </section>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
