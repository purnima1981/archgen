import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Screen = "home" | "login" | "signup";

export default function Landing() {
  const [screen, setScreen] = useState<Screen>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Registration failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setError("");
  };

  // ─── HOME SCREEN ───────────────────────────────────────
  if (screen === "home") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          {/* Logo */}
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <span className="text-white text-2xl">◇</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
            ArchGen
          </h1>
          <p className="text-gray-500 text-sm mb-12">
            AI-powered architecture diagram generator
          </p>

          {/* Value props */}
          <div className="space-y-4 mb-12 text-left">
            <div className="flex items-start gap-3">
              <span className="text-sm mt-0.5 text-gray-400">01</span>
              <p className="text-sm text-gray-600">
                Describe your system in plain English
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm mt-0.5 text-gray-400">02</span>
              <p className="text-sm text-gray-600">
                AI generates a professional architecture diagram
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm mt-0.5 text-gray-400">03</span>
              <p className="text-sm text-gray-600">
                Export to draw.io and share with your team
              </p>
            </div>
          </div>

          {/* CTAs */}
          <button
            onClick={() => { resetForm(); setScreen("signup"); }}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors mb-4"
          >
            Get Started
          </button>
          <p className="text-gray-400 text-sm">
            Already have an account?{" "}
            <span
              className="text-gray-900 cursor-pointer hover:underline font-medium"
              onClick={() => { resetForm(); setScreen("login"); }}
            >
              Log in
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ─── LOGIN SCREEN ──────────────────────────────────────
  if (screen === "login") {
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 pt-12 max-w-sm mx-auto">
        <button
          onClick={() => { resetForm(); setScreen("home"); }}
          className="text-gray-400 hover:text-gray-900 text-sm mb-8 self-start transition-colors"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center">
            <span className="text-white text-xs">◇</span>
          </div>
          <span className="text-gray-400 text-sm font-medium">ArchGen</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Welcome back</h2>

        <div className="space-y-5">
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-900 transition-colors bg-gray-50"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-900 transition-colors bg-gray-50"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>

          <p className="text-gray-400 text-sm text-center pt-2">
            Don't have an account?{" "}
            <span
              className="text-gray-900 cursor-pointer hover:underline font-medium"
              onClick={() => { resetForm(); setScreen("signup"); }}
            >
              Sign up
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ─── SIGNUP SCREEN ─────────────────────────────────────
  if (screen === "signup") {
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 pt-12 max-w-sm mx-auto">
        <button
          onClick={() => { resetForm(); setScreen("home"); }}
          className="text-gray-400 hover:text-gray-900 text-sm mb-8 self-start transition-colors"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center">
            <span className="text-white text-xs">◇</span>
          </div>
          <span className="text-gray-400 text-sm font-medium">ArchGen</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Create your account
        </h2>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">
                First name
              </label>
              <input
                type="text"
                placeholder="First"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-900 transition-colors bg-gray-50"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">
                Last name
              </label>
              <input
                type="text"
                placeholder="Last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-900 transition-colors bg-gray-50"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-900 transition-colors bg-gray-50"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-900 transition-colors bg-gray-50"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-gray-400 text-sm text-center pt-2">
            Already have an account?{" "}
            <span
              className="text-gray-900 cursor-pointer hover:underline font-medium"
              onClick={() => { resetForm(); setScreen("login"); }}
            >
              Log in
            </span>
          </p>
        </div>
      </div>
    );
  }

  return null;
}
