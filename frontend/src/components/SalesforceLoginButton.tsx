import React from "react";

function computeFunctionsLoginUrl(): string {
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const functionsUrlEnv = (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;

  const base = (functionsUrlEnv && functionsUrlEnv.trim().length > 0)
    ? functionsUrlEnv.replace(/\/$/, "")
    : (supabaseUrl || "").replace(".supabase.co", ".functions.supabase.co").replace(/\/$/, "");

  return `${base}/salesforce-oauth/login`;
}

const SalesforceLoginButton: React.FC = () => {
  const handleLogin = () => {
    const loginUrl = computeFunctionsLoginUrl();
    window.location.href = loginUrl;
  };

  return (
    <button
      onClick={handleLogin}
      className="btn btn-primary btn-lg"
      style={{
        padding: "12px 24px",
        fontSize: "16px",
        backgroundColor: "#00A1DE",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        width: "100%",
      }}
    >
      🔐 Login with Salesforce
    </button>
  );
};

export default SalesforceLoginButton;


