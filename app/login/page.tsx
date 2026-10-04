"use client"

import { Suspense, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter, useSearchParams } from "next/navigation"
import { TriangleAlert } from "lucide-react"
import { toLoginEmail } from "@/lib/logins"
import { getMe } from "@/lib/services/coachService"
import "./login.css"

// Set by app/admin/layout.tsx when it signs someone out
const REASONS: Record<string, string> = {
  "no-access": "This account doesn't have access (it may have been deactivated).",
}

// Coaches and athletes sign in with a username, admins with their email — see lib/logins.ts
function LoginForm() {
  const router = useRouter()
  const reason = useSearchParams().get("reason")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(reason ? REASONS[reason] ?? null : null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: toLoginEmail(identifier),
      password,
    })

    if (error) {
      setLoading(false)
      setError(
        error.code === "user_banned"         ? REASONS["no-access"] :
        error.code === "invalid_credentials" ? "Wrong username or password" :
        error.message
      )
      return
    }

    // Athletes → their app; coaches/admins → the admin area (whose layout sends a coach with a temporary
    // password to /admin/password first). If /api/me fails, the admin layout sorts it out.
    const me = await getMe().catch(() => null)
    router.push(me?.athlete && !me.isAdmin && !me.coach ? "/me" : "/admin/athletes")
  }

  return (
    <div className="page login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="logo">Glabro</div>
        <h1 className="login-title">Sign in</h1>

        <div className="field">
          <label className="field-label" htmlFor="login-identifier">Username or email</label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            className="field-input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert-error" role="alert">
            <TriangleAlert size={14} aria-hidden /> {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  )
}

// useSearchParams needs a Suspense boundary so the page can still be prerendered
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
