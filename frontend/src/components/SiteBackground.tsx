import { useLocation } from "react-router-dom";

export default function SiteBackground() {
  const location = useLocation();
  const hideOnAuth = location.pathname.startsWith("/auth");
  if (hideOnAuth) return null;
  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-neutral-800" />
    </div>
  );
}


