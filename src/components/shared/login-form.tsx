"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { loginAction, type LoginActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" type="submit" disabled={pending} data-audit-action="login-submit" data-audit-type="auth">
      {pending ? "..." : label}
    </Button>
  );
}

interface LoginFormProps {
  locale: string;
  dictionary: {
    auth: {
      email: string;
      password: string;
      signIn: string;
      loginSuccess: string;
    };
  };
}

export function LoginForm({ locale, dictionary }: LoginFormProps) {
  const router = useRouter();
  const didHandleSuccess = useRef(false);

  const initialState: LoginActionState = {
    error: null,
    success: false,
    redirectTo: null,
  };

  const [state, action] = useFormState(loginAction, initialState);

  useEffect(() => {
    if (!state.success || !state.redirectTo || didHandleSuccess.current) {
      return;
    }

    didHandleSuccess.current = true;
    toast.success(dictionary.auth.loginSuccess);
    window.setTimeout(() => {
      router.push(state.redirectTo as string);
      router.refresh();
    }, 500);
  }, [dictionary.auth.loginSuccess, router, state.redirectTo, state.success]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Input name="email" type="email" required placeholder={dictionary.auth.email} />
      <Input name="password" type="password" required placeholder={dictionary.auth.password} />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton label={dictionary.auth.signIn} />
    </form>
  );
}
