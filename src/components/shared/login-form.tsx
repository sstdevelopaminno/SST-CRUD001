"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";

import { loginAction, type LoginActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" type="submit" disabled={pending} data-audit-action="login-submit" data-audit-type="auth">
      {pending ? "Signing in..." : label}
    </Button>
  );
}

interface LoginFormProps {
  locale: string;
  nextPath: string | null;
  dictionary: {
    auth: {
      email: string;
      password: string;
      signIn: string;
      loginSuccess: string;
    };
  };
}

export function LoginForm({ locale, nextPath, dictionary }: LoginFormProps) {
  const didHandleSuccess = useRef(false);
  const handledError = useRef<string | null>(null);
  const loadingToastId = useRef<string | number | null>(null);

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
    handledError.current = null;

    if (loadingToastId.current) {
      toast.dismiss(loadingToastId.current);
      loadingToastId.current = null;
    }

    toast.success(dictionary.auth.loginSuccess, { duration: 1200 });

    window.setTimeout(() => {
      window.location.assign(state.redirectTo as string);
    }, 250);
  }, [dictionary.auth.loginSuccess, state.redirectTo, state.success]);

  useEffect(() => {
    if (!state.error || handledError.current === state.error) {
      return;
    }

    handledError.current = state.error;

    if (loadingToastId.current) {
      toast.dismiss(loadingToastId.current);
      loadingToastId.current = null;
    }

    toast.error(state.error);
  }, [state.error]);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={() => {
        if (loadingToastId.current) {
          toast.dismiss(loadingToastId.current);
        }
        loadingToastId.current = toast.loading("Signing in...");
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={nextPath ?? ""} />
      <Input name="email" type="email" required placeholder={dictionary.auth.email} />
      <Input name="password" type="password" required placeholder={dictionary.auth.password} />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton label={dictionary.auth.signIn} />
    </form>
  );
}
