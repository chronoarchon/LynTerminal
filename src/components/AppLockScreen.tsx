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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F5F5F7] p-4 select-none">
      {/* Central Apple Lock Cockpit */}
      <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* User / Store Avatar Badge */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xl border-2 border-white/60">
            <Lock className="w-9 h-9 stroke-[2]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#34C759] border-2 border-white flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-white stroke-[2.5]" />
          </div>
        </div>

        {/* Store Name & Admin User */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-black/[0.06] shadow-2xs mb-2">
          <Store className="w-3.5 h-3.5 text-[#6E6E73]" />
          <span className="text-xs font-semibold text-[#1D1D1F] max-w-[180px] truncate">
            {settings?.business_name || "LynTerminal Store"}
          </span>
        </div>

        <h1 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight">
          {authState?.username || "Administrator"}
        </h1>
        <p className="text-xs text-[#86868B] mt-0.5 font-medium">
          Workstation Locked
        </p>

        {/* Error message */}
        {unlockError && (
          <div className="mt-3 w-full p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2 text-left animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
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
              placeholder="Enter master password"
              autoFocus
              className="w-full px-4 py-3 pr-10 rounded-2xl border border-black/[0.12] bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 text-xs text-[#1D1D1F] outline-none transition shadow-xs text-center font-medium placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-bold shadow-md transition apple-press flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Unlock className="w-4 h-4 stroke-[2.5]" />
            <span>{isVerifying ? "Verifying..." : "Unlock Workstation"}</span>
          </button>
        </form>

        {/* Forgot Password Trigger */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsRecoveryOpen(true)}
            className="text-xs text-[#0071E3] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Forgot Password? Reset with Recovery Key</span>
          </button>
        </div>

        {/* System security tag */}
        <div className="mt-8 text-[11px] text-[#86868B] font-mono">
          LynTerminal 100% Offline · Local SQLite WAL
        </div>
      </div>

      {/* Forgot Password / Recovery Key Modal */}
      {isRecoveryOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-black/[0.08] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Reset Master Password</h3>
                  <p className="text-[11px] text-[#86868B]">Use your 18-character recovery key</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRecoveryOpen(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-[#6E6E73] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recoveryError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{recoveryError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                  18-Character Recovery Key
                </label>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="e.g. LYN-8K9P-4V1R-5Z7W-2X"
                  className="w-full px-3 py-2.5 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] text-xs font-mono tracking-wider text-[#1D1D1F] outline-none uppercase"
                />
                <p className="text-[10px] text-[#86868B] mt-1">
                  Dashes and lowercase letters are handled automatically.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                  New Master Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2.5 pr-9 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] text-xs text-[#1D1D1F] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F]"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2.5 pr-9 rounded-xl border border-black/[0.12] bg-[#FAFAFC] focus:bg-white focus:border-[#0071E3] text-xs text-[#1D1D1F] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F]"
                  >
                    {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(false)}
                  className="px-4 py-2 rounded-xl border border-black/[0.1] bg-white text-xs font-semibold text-[#1D1D1F] hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold shadow-xs transition apple-press cursor-pointer disabled:opacity-50"
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
