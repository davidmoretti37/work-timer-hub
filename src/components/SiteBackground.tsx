import { useLocation } from "react-router-dom";

export default function SiteBackground() {
  const location = useLocation();
  const hideOnAuth = location.pathname.startsWith("/auth");
  if (hideOnAuth) return null;
  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-neutral-900" />
      {/* Soft cyan glow toward the top center */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_560px_at_50%_200px,#38bdf8,transparent)] opacity-70" />
      {/* Subtle vignette to focus content */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_120%,rgba(0,0,0,0.55),transparent_60%)]" />
      {/* Blurred color blooms for depth */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[700px] h-[700px] rounded-full bg-cyan-400/20 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[650px] h-[650px] rounded-full bg-sky-500/20 blur-[140px]" />
    </div>
  );
}


