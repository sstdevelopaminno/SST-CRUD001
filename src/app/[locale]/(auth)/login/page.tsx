import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/shared/login-form";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";

const LOGO_URL =
  "https://vdvpqowmusdgthmotbfe.supabase.co/storage/v1/object/public/sstcrud/Image%20001.png";

export default async function LoginPage({ params }: { params: { locale: string } }) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.3),transparent_35%),linear-gradient(160deg,#020617,#0f172a)]" />
      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full border-white/20 bg-white/95 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
              <img src={LOGO_URL} alt="SST CRUD Logo" className="h-full w-full rounded-2xl object-cover" />
            </div>
            <div className="pt-2 text-center">
              <p className="text-5xl font-black uppercase leading-none tracking-[0.08em] text-slate-900">CRUD</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">{dictionary.app.company}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <LoginForm locale={locale} dictionary={dictionary} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

