import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  size = 30,
  showText = true,
  light = false,
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Apple-style squircle icon with approved Continuous Minimalist 'L' */}
      <div
        className={`relative flex items-center justify-center rounded-xl shadow-xs transition-transform overflow-hidden ${
          light
            ? "bg-[#18191E] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-black/[0.08]"
            : "bg-[#18191E] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] border border-white/[0.08]"
        }`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          className="w-full h-full p-1"
        >
          <defs>
            <linearGradient id="lynterminalLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2997FF" />
              <stop offset="60%" stopColor="#0071E3" />
              <stop offset="100%" stopColor="#00C7BE" />
            </linearGradient>
          </defs>
          <path
            d="M 188 128 V 334 C 188 358 206 376 230 376 H 352"
            fill="none"
            stroke="url(#lynterminalLogoGradient)"
            strokeWidth="76"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-semibold tracking-tight text-[15px] ${
                light ? "text-[#1D1D1F]" : "text-[#F5F5F7]"
              }`}
            >
              LynTerminal
            </span>
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                light
                  ? "bg-black/[0.05] text-[#6E6E73]"
                  : "bg-white/[0.1] text-[#A1A1A6]"
              }`}
            >
              v1.5.0v
            </span>
          </div>
          <span
            className={`text-[10px] tracking-tight mt-0.5 font-normal ${
              light ? "text-[#86868B]" : "text-[#86868B]"
            }`}
          >
            Register &amp; Business OS
          </span>
        </div>
      )}
    </div>
  );
};
