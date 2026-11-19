import React, { useState } from "react";
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  X,
  Store,
} from "lucide-react";
import { api } from "../services/api";
import type { Settings, AuthState } from "../types";
import { useAppleDialog } from "./common/AppleDialog";

interface AppLockScreenProps {
  isLocked: boolean;
  settings: Settings | null;
  authState: AuthState | null;
  onUnlocked: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  isLocked,
  settings,
  authState,
  onUnlocked,
}) => {
  const { alert, toast } = useAppleDialog();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Recovery Modal State
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Safeguard: If Lock Screen mounts when no password hash exists in storage, automatically bypass/unlock immediately
  React.useEffect(() => {
    if (isLocked) {
      if (authState && !authState.has_account) {
        api.setAppLocked(false).finally(() => {
          onUnlocked();
        });
      } else {
        api.getAuthState().then((auth) => {
          if (!auth.has_account) {
            api.setAppLocked(false).finally(() => {
              onUnlocked();
            });
          }
        }).catch(() => {});
      }
    }
  }, [isLocked, authState, onUnlocked]);

  if (!isLocked) return null;

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUnlockError("");

    if (!password) {
      setUnlockError("Please enter your master password.");
      return;
    }

    try {
      setIsVerifying(true);
      await api.verifyUnlockPassword(password);
      setPassword("");
      onUnlocked();
      toast({
        message: "Workstation unlocked",
        type: "success",
      });
    } catch (err) {
      setUnlockError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");

    if (!recoveryCode.trim()) {
      setRecoveryError("Please enter your 18-character recovery key.");
      return;
    }
    if (newPassword.length < 4) {
      setRecoveryError("New password must be at least 4 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError("New passwords do not match.");
      return;
    }

    try {
      setIsResetting(true);
      await api.resetPasswordWithRecoveryCode(recoveryCode.trim(), newPassword);
      setIsRecoveryOpen(false);
      setRecoveryCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPassword("");
      onUnlocked();
      alert({
        title: "Password Reset Successfully",
        message: "Your master password has been reset and your workstation is now unlocked.",
        type: "info",
      });
    } catch (err) {
      setRecoveryError(String(err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0d0e] p-4 select-none">
      {/* Central Obsidian Lock Cockpit */}
      <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* User / Store Avatar Badge */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl bg-[#13151a] text-white flex items-center justify-center shadow-2xl border border-white/10">
            <Lock className="w-9 h-9 stroke-[2]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white text-black border-2 border-[#0c0d0e] flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>

        {/* Store Name & Admin User */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#13151a] border border-white/10 mb-2">
          <Store className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-xs font-semibold text-white max-w-[180px] truncate">
            {settings?.business_name || "LynTerminal"}
          </span>
        </div>

        <h1 className="text-xl font-extrabold text-white tracking-tight">
          {authState?.username || "Admin"}
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5 font-medium uppercase tracking-wider">
          Workstation Locked
        </p>

        {/* Error message */}
        {unlockError && (
          <div className="mt-3 w-full p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-medium text-red-200 flex items-center gap-2 text-left animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="truncate">{unlockError}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="w-full mt-4 space-y-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master Password"
              autoFocus
              className="w-full px-4 py-3 pr-10 rounded-2xl border border-white/10 bg-[#0e1015] focus:border-white/40 focus:ring-1 focus:ring-white/20 text-xs text-white outline-none transition shadow-inner text-center font-medium placeholder:text-neutral-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Unlock className="w-4 h-4 stroke-[2.5]" />
            <span>{isVerifying ? "Verifying..." : "Unlock"}</span>
          </button>
        </form>

        {/* Forgot Password Trigger */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsRecoveryOpen(true)}
            className="text-xs text-neutral-400 hover:text-white transition font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Reset with Recovery Key</span>
          </button>
        </div>

        {/* System security tag */}
        <div className="mt-8 text-[11px] text-neutral-500 font-mono">
          LynTerminal Offline · Local SQLite WAL
        </div>
      </div>

      {/* Forgot Password / Recovery Key Modal */}
      {isRecoveryOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#13151a] rounded-3xl shadow-2xl border border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Reset Password</h3>
                  <p className="text-[11px] text-neutral-400">18-Character Recovery Key</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRecoveryOpen(false)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recoveryError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-medium text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{recoveryError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Recovery Key
                </label>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="LYN-XXXX-XXXX-XXXX-XX"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-[#0e1015] focus:border-white/40 text-xs font-mono tracking-wider text-white outline-none uppercase placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2.5 pr-9 rounded-xl border border-white/10 bg-[#0e1015] focus:border-white/40 text-xs text-white outline-none placeholder:text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2.5 pr-9 rounded-xl border border-white/10 bg-[#0e1015] focus:border-white/40 text-xs text-white outline-none placeholder:text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(false)}
                  className="px-4 py-2 rounded-full border border-white/10 bg-[#181a21] text-xs font-semibold text-neutral-300 hover:bg-[#20232c] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? "Resetting..." : "Reset & Unlock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
