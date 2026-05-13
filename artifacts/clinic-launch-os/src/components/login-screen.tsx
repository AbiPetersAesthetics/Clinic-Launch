import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/auth";

// ─── Decorative leaf/botanical SVG mark ───────────────────────────────────────
function BotanicalMark() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Stem */}
      <path
        d="M24 42 C24 42 24 24 24 14"
        stroke="hsl(161, 40%, 52%)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Left leaf */}
      <path
        d="M24 28 C20 24 13 22 11 16 C15 14 22 18 24 24"
        fill="hsl(161, 40%, 52%)"
        fillOpacity="0.35"
        stroke="hsl(161, 40%, 52%)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Right leaf */}
      <path
        d="M24 22 C28 17 35 16 37 10 C33 8 26 13 24 19"
        fill="hsl(161, 40%, 52%)"
        fillOpacity="0.55"
        stroke="hsl(161, 40%, 52%)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Small accent leaf */}
      <path
        d="M24 34 C21 31 17 31 15 28 C18 26 22 28 24 32"
        fill="hsl(161, 40%, 52%)"
        fillOpacity="0.25"
        stroke="hsl(161, 40%, 52%)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Divider line ─────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div className="flex items-center gap-3 w-full">
      <div style={{ flex: 1, height: 1, background: "hsl(163, 18%, 22%)" }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "hsl(161, 40%, 42%)", opacity: 0.5 }} />
      <div style={{ flex: 1, height: 1, background: "hsl(163, 18%, 22%)" }} />
    </div>
  );
}

// ─── Main login screen ────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    // Small deliberate pause — feels more secure, prevents instant brute-force feel
    await new Promise((r) => setTimeout(r, 400));

    const success = login(password);
    setLoading(false);

    if (!success) {
      setError(true);
      setShake(true);
      setPassword("");
      setTimeout(() => setShake(false), 600);
      setTimeout(() => setError(false), 3000);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "hsl(163, 28%, 12%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "hsl(163, 22%, 16%)",
          border: "1px solid hsl(163, 18%, 22%)",
          borderRadius: "16px",
          padding: "40px 36px 36px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
          animation: "fadeSlideUp 0.4s ease both",
        }}
        className={shake ? "shake" : ""}
      >
        {/* Logo mark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <BotanicalMark />
        </div>

        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div
            style={{
              color: "hsl(36, 20%, 94%)",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "1.6rem",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
            }}
          >
            Abi Peters Aesthetics
          </div>
          <div
            style={{
              color: "hsl(36, 20%, 60%)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginTop: "6px",
            }}
          >
            Clinic Launch OS
          </div>
        </div>

        {/* Divider */}
        <div style={{ marginTop: "28px", marginBottom: "28px" }}>
          <Divider />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                color: "hsl(36, 20%, 70%)",
                fontSize: "0.7rem",
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Access Code
            </label>
            <input
              ref={inputRef}
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter your access code"
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "hsl(163, 28%, 10%)",
                border: `1px solid ${error ? "hsl(0, 60%, 45%)" : "hsl(163, 18%, 24%)"}`,
                borderRadius: "8px",
                color: "hsl(36, 20%, 94%)",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = error ? "hsl(0, 60%, 50%)" : "hsl(161, 40%, 42%)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = error ? "hsl(0, 60%, 45%)" : "hsl(163, 18%, 24%)";
              }}
            />
            {/* Error message */}
            <div
              style={{
                height: "18px",
                marginTop: "6px",
                fontSize: "0.75rem",
                color: "hsl(0, 60%, 60%)",
                opacity: error ? 1 : 0,
                transition: "opacity 0.2s",
              }}
            >
              Incorrect access code. Please try again.
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              padding: "11px 20px",
              background: loading || !password.trim()
                ? "hsl(161, 30%, 35%)"
                : "hsl(161, 40%, 42%)",
              color: "hsl(0, 0%, 100%)",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: loading || !password.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s, opacity 0.2s",
              opacity: loading || !password.trim() ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Verifying…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: "28px",
            textAlign: "center",
            color: "hsl(163, 10%, 42%)",
            fontSize: "0.65rem",
            letterSpacing: "0.06em",
          }}
        >
          Private &amp; Confidential — Authorised Access Only
        </div>
      </div>

      {/* Version tag */}
      <div
        style={{
          marginTop: "20px",
          color: "hsl(163, 10%, 35%)",
          fontSize: "0.65rem",
          letterSpacing: "0.08em",
        }}
      >
        Launch OS v1.0
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .shake {
          animation: shake 0.5s ease both !important;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-5px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
