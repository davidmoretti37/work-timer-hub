import React from "react";
import "./ShinyText.css";

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  speed?: number; // seconds per loop
  className?: string;
};

const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 5,
  className = "",
}) => {
  const animationDuration = `${speed}s`;

  return (
    <span className={`shiny-text ${disabled ? "disabled" : ""} ${className}`} style={{ ['--shine-duration' as any]: animationDuration }}>
      <span className="shiny-text__base">{text}</span>
      <span className="shiny-text__shine" aria-hidden="true">{text}</span>
    </span>
  );
};

export default ShinyText;


