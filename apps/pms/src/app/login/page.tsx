import Link from "next/link";
import { AUTH_ERROR_MESSAGE, LOGIN_PAGE_ERROR_PARAM } from "@hotel/shared";
import { loginAction } from "./actions";

const errorMessages: Record<string, string> = {
  [LOGIN_PAGE_ERROR_PARAM.MISSING_FIELDS]: AUTH_ERROR_MESSAGE.AUTH_MISSING_FIELDS,
  [LOGIN_PAGE_ERROR_PARAM.INVALID_CREDENTIALS]: AUTH_ERROR_MESSAGE.AUTH_INVALID_CREDENTIALS
};

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const error = searchParams?.error;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "linear-gradient(160deg, #f8f0e8 0%, #f4f9ff 100%)" }}>
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e6e6e6",
          borderRadius: "14px",
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.06)"
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Login do PMS</h1>
        <p style={{ marginTop: 0, color: "#555" }}>Use email e senha para acessar seu dashboard.</p>

        {error && errorMessages[error] ? (
          <p style={{ color: "#b00020", marginBottom: "1rem" }}>{errorMessages[error]}</p>
        ) : null}

        <form action={loginAction} style={{ display: "grid", gap: "0.9rem" }}>
          <label style={{ display: "grid", gap: "0.4rem" }}>
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              style={{ border: "1px solid #d0d0d0", borderRadius: "8px", padding: "0.7rem" }}
            />
          </label>

          <label style={{ display: "grid", gap: "0.4rem" }}>
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{ border: "1px solid #d0d0d0", borderRadius: "8px", padding: "0.7rem" }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: "0.4rem",
              border: 0,
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              background: "#0f6d5f",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Entrar
          </button>
        </form>

        <p style={{ marginBottom: 0, marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
          Ainda sem tela inicial? Volte para a <Link href="/">home</Link>.
        </p>
      </section>
    </main>
  );
}
