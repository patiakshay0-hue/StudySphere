import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  setAuthToken,
  getAuthToken,
  type AppConfig,
  type FileItem,
  type Mode,
  type User,
} from "./api";

interface ToastMsg {
  id: number;
  text: string;
  err: boolean;
}

interface AppContextValue {
  // auth
  user: User | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  setUser: (u: User) => void;
  justAuthed: boolean;
  clearWelcome: () => void;
  // config
  config: AppConfig | null;
  // mode
  mode: Mode;
  setMode: (m: Mode) => void;
  // files / scope
  files: FileItem[];
  curriculum: Record<string, string[]>;
  scopeId: number | null;
  setScopeId: (id: number | null) => void;
  refreshFiles: () => void;
  // ui
  toast: (text: string, err?: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [justAuthed, setJustAuthed] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [mode, setMode] = useState<Mode>("offline");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [curriculum, setCurriculum] = useState<Record<string, string[]>>({});
  const [scopeId, setScopeId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counter = useRef(0);

  const toast = useCallback((text: string, err = false) => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const refreshFiles = useCallback(() => {
    if (!getAuthToken()) return;
    api
      .files()
      .then((d) => {
        setFiles(d.files);
        setCurriculum(d.curriculum);
      })
      .catch(() => {});
  }, []);

  const refreshUser = useCallback(() => {
    if (!getAuthToken()) return;
    api.me().then(setUserState).catch(() => {});
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUserState(null);
    setFiles([]);
    setScopeId(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api.login(email, password);
      setAuthToken(token);
      setUserState(user);
      setJustAuthed(true);
    },
    []
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const { token, user } = await api.signup(name, email, password);
      setAuthToken(token);
      setUserState(user);
      setJustAuthed(true);
    },
    []
  );

  const clearWelcome = useCallback(() => setJustAuthed(false), []);

  // Load public config once.
  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
  }, []);

  // Restore session from a stored token.
  useEffect(() => {
    if (getAuthToken()) {
      api
        .me()
        .then(setUserState)
        .catch(() => setAuthToken(null))
        .finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
  }, []);

  // Load files whenever a user becomes available.
  useEffect(() => {
    if (user) refreshFiles();
  }, [user, refreshFiles]);

  // If online mode is unavailable on the server, force offline.
  useEffect(() => {
    if (config && !config.ai_enabled) setMode("offline");
  }, [config]);

  return (
    <AppContext.Provider
      value={{
        user,
        authReady,
        login,
        signup,
        logout,
        refreshUser,
        setUser,
        justAuthed,
        clearWelcome,
        config,
        mode,
        setMode,
        files,
        curriculum,
        scopeId,
        setScopeId,
        refreshFiles,
        toast,
      }}
    >
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={"toast show" + (t.err ? " err" : "")}>
            {t.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
