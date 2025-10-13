"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ColorVariant = "default" | "primary" | "success" | "error" | "gold" | "bronze";

interface MetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ColorVariant;
  fullWidth?: boolean; // make wrapper/button take full width
  wrapperClassName?: string; // optional extra classes for wrapper
}

const colorVariants: Record<
  ColorVariant,
  { outer: string; inner: string; button: string; textColor: string; textShadow: string }
> = {
  default: {
    outer: "bg-transparent",
    inner: "bg-transparent",
    button: "bg-neutral-900 hover:bg-neutral-800 text-white",
    textColor: "text-white",
    textShadow: "",
  },
  primary: {
    outer: "bg-gradient-to-b from-[#000] to-[#A0A0A0]",
    inner: "bg-gradient-to-b from-primary via-secondary to-muted",
    button: "bg-gradient-to-b from-primary to-primary/40",
    textColor: "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(30_58_138_/_100%)]",
  },
  success: {
    outer: "bg-gradient-to-b from-[#005A43] to-[#7CCB9B]",
    inner: "bg-gradient-to-b from-[#E5F8F0] via-[#00352F] to-[#D1F0E6]",
    button: "bg-gradient-to-b from-[#9ADBC8] to-[#3E8F7C]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(6_78_59_/_100%)]",
  },
  error: {
    outer: "bg-gradient-to-b from-[#5A0000] to-[#FFAEB0]",
    inner: "bg-gradient-to-b from-[#FFDEDE] via-[#680002] to-[#FFE9E9]",
    button: "bg-gradient-to-b from-[#F08D8F] to-[#A45253]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(146_64_14_/_100%)]",
  },
  gold: {
    outer: "bg-gradient-to-b from-[#917100] to-[#EAD98F]",
    inner: "bg-gradient-to-b from-[#FFFDDD] via-[#856807] to-[#FFF1B3]",
    button: "bg-gradient-to-b from-[#FFEBA1] to-[#9B873F]",
    textColor: "text-[#FFFDE5]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(178_140_2_/_100%)]",
  },
  bronze: {
    outer: "bg-gradient-to-b from-[#864813] to-[#E9B486]",
    inner: "bg-gradient-to-b from-[#EDC5A1] via-[#5F2D01] to-[#FFDEC1]",
    button: "bg-gradient-to-b from-[#FFE3C9] to-[#A36F3D]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(124_45_18_/_100%)]",
  },
};

const metalButtonVariants = (
  variant: ColorVariant = "default",
  isPressed: boolean,
  isHovered: boolean,
  isTouchDevice: boolean,
) => {
  const colors = colorVariants[variant];
  const transitionStyle = "all 250ms cubic-bezier(0.1, 0.4, 0.2, 1)";

  return {
    wrapper: cn("relative inline-flex transform-gpu rounded-md p-[1.25px] will-change-transform", colors.outer),
    wrapperStyle: {
      transform: isPressed ? "translateY(2.5px) scale(0.99)" : "translateY(0) scale(1)",
      boxShadow: isPressed
        ? "0 1px 2px rgba(0, 0, 0, 0.15)"
        : isHovered && !isTouchDevice
          ? "0 4px 12px rgba(0, 0, 0, 0.12)"
          : "0 3px 8px rgba(0, 0, 0, 0.08)",
      transition: transitionStyle,
      transformOrigin: "center center",
    } as React.CSSProperties,
    inner: cn("absolute inset-[1px] transform-gpu rounded-lg will-change-transform", colors.inner),
    innerStyle: {
      transition: transitionStyle,
      transformOrigin: "center center",
      filter: isHovered && !isPressed && !isTouchDevice ? "brightness(1.05)" : "none",
    } as React.CSSProperties,
    button: cn(
      "relative z-10 m-[1px] rounded-md inline-flex h-11 transform-gpu cursor-pointer items-center justify-center overflow-hidden rounded-md px-6 py-2 text-sm leading-none font-semibold will-change-transform outline-none",
      colors.button,
      colors.textColor,
      colors.textShadow,
    ),
    buttonStyle: {
      transform: isPressed ? "scale(0.97)" : "scale(1)",
      transition: transitionStyle,
      transformOrigin: "center center",
      filter: isHovered && !isPressed && !isTouchDevice ? "brightness(1.02)" : "none",
    } as React.CSSProperties,
  };
};

const ShineEffect = ({ isPressed }: { isPressed: boolean }) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-300",
        isPressed ? "opacity-20" : "opacity-0",
      )}
    >
      <div className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-neutral-100 to-transparent" />
    </div>
  );
};

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ children, className, variant = "default", fullWidth, wrapperClassName, ...props }, ref) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isTouchDevice, setIsTouchDevice] = React.useState(false);

    React.useEffect(() => {
      setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
    }, []);

    const variants = metalButtonVariants(variant, isPressed, isHovered, isTouchDevice);

    const handleInternalMouseDown = () => setIsPressed(true);
    const handleInternalMouseUp = () => setIsPressed(false);
    const handleInternalMouseLeave = () => { setIsPressed(false); setIsHovered(false); };
    const handleInternalMouseEnter = () => { if (!isTouchDevice) setIsHovered(true); };
    const handleInternalTouchStart = () => setIsPressed(true);
    const handleInternalTouchEnd = () => setIsPressed(false);
    const handleInternalTouchCancel = () => setIsPressed(false);

    return (
      <div
        className={cn(variants.wrapper, fullWidth && "w-full", wrapperClassName)}
        style={variants.wrapperStyle}
      >
        <div className={variants.inner} style={variants.innerStyle}></div>
        <button
          ref={ref}
          className={cn(variants.button, fullWidth && "w-full", className)}
          style={variants.buttonStyle}
          {...props}
          onMouseDown={handleInternalMouseDown}
          onMouseUp={handleInternalMouseUp}
          onMouseLeave={handleInternalMouseLeave}
          onMouseEnter={handleInternalMouseEnter}
          onTouchStart={handleInternalTouchStart}
          onTouchEnd={handleInternalTouchEnd}
          onTouchCancel={handleInternalTouchCancel}
        >
          <ShineEffect isPressed={isPressed} />
          {children || "Button"}
          {isHovered && !isPressed && !isTouchDevice && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t rounded-lg from-transparent to-white/5" />
          )}
        </button>
      </div>
    );
  }
);

MetalButton.displayName = "MetalButton";

export default MetalButton;


