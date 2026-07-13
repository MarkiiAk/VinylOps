import { LoginForm } from "./_components/login-form";

export const metadata = {
  title: "Iniciar sesión — VinylOps",
};

/**
 * Login (Fase 7, V1): fuera del grupo (dashboard), sin nav/sidebar. Ruta
 * pública explícita — ver middleware.ts, es la única página del dashboard
 * accesible sin sesión.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">VinylOps</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pricing Studio — acceso interno</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
