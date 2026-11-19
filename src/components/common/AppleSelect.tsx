import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface AppleSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export type AppleSelectOptionType = string | AppleSelectOption;

interface AppleSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: AppleSelectOptionType[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  direction?: "up" | "down" | "auto";
}

export const AppleSelect: React.FC<AppleSelectProps> = ({
  value = "",
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  disabled = false,
  direction = "auto",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to object format
  const normalizedOptions: AppleSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);

      // Determine open direction
      if (direction === "auto" && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 220 && rect.top > 220) {
          setOpenUpward(true);
        } else {
          setOpenUpward(false);
        }
      } else if (direction === "up") {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, direction]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-neutral-50 text-black border border-black/10 text-xs font-medium transition cursor-pointer select-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate pr-1">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-500 shrink-0 ml-1.5 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } bg-white text-black rounded-2xl shadow-2xl border border-black/10 p-1.5 z-[100] max-h-60 overflow-y-auto ${menuClassName}`}
          style={{ minWidth: "100%" }}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400 text-center">No options</div>
          ) : (
            normalizedOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer select-none ${
                    isSelected
                      ? "bg-black text-white font-bold"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-black"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <div className="flex flex-col truncate">
                      <span className="truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className={`text-[10px] truncate ${isSelected ? "text-neutral-300" : "text-neutral-400"}`}>
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2 stroke-[2.5]" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
