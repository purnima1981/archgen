import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

export default function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="h-14 px-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs">◇</span>
          </div>
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            ArchGen
          </span>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">
            BETA
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {user.firstName || user.email}
          </span>
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
          >
            {isLoggingOut ? "..." : "Logout"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 56px)" }}>
        <div className="text-center">
          <div className="text-5xl mb-6 text-gray-200">◇</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Welcome, {user.firstName || "there"}
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            You're signed in. The diagram generator is coming next.
          </p>
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-5 py-3">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm text-gray-500">
              Auth system working · Session active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
