import Link from "next/link";
import { loginAction } from "./actions";
import { PendingSubmitButton } from "../_components/PendingSubmitButton";
import { LoginErrorMessage } from "./_components/LoginErrorMessage";
import { LOGIN_SUBMIT_BUTTON_PROPS } from "./submitButtonConfig";

export const dynamic = "force-static";

export default function LoginPage() {

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,#f8f0e8_0%,#f4f9ff_100%)] p-8">
      <section className="w-full max-w-[420px] rounded-[14px] border border-[#e6e6e6] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
        <h1 className="mb-[0.4rem] mt-0">Login do PMS</h1>
        <p className="mt-0 text-[#555]">Use email e senha para acessar seu dashboard.</p>

        <LoginErrorMessage />

        <form action={loginAction} className="grid gap-[0.9rem]">
          <label className="grid gap-[0.4rem]">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-lg border border-[#d0d0d0] p-[0.7rem]"
            />
          </label>

          <label className="grid gap-[0.4rem]">
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-lg border border-[#d0d0d0] p-[0.7rem]"
            />
          </label>

          <PendingSubmitButton {...LOGIN_SUBMIT_BUTTON_PROPS}>
            Entrar
          </PendingSubmitButton>
        </form>

        <p className="mb-0 mt-4 text-[0.9rem] text-[#666]">
          Ainda sem tela inicial? Volte para a <Link href="/">home</Link>.
        </p>
      </section>
    </main>
  );
}
