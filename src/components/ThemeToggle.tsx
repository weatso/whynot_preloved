"use client";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={`Ganti ke mode ${theme === "dark" ? "terang" : "gelap"}`}
      style={{
        background: "transparent",
        border: "1px solid var(--color-brand-border)",
        borderRadius: "8px",
        padding: "0.4rem 0.7rem",
        cursor: "pointer",
        fontSize: "1.1rem",
        lineHeight: 1,
        color: "var(--color-brand-text)",
        transition: "all 0.2s",
        flexShrink: 0,
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
