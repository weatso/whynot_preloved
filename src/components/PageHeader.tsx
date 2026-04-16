"use client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

interface PageHeaderProps {
  title: string;
  backPath?: string;
  children?: React.ReactNode;
}

/** Shared page header with back button and theme toggle for all owner sub-pages */
export function PageHeader({ title, backPath = "/owner", children }: PageHeaderProps) {
  const router = useRouter();
  return (
    <header className="wnp-header no-print">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
        <button
          onClick={() => router.push(backPath)}
          style={{
            background: "transparent",
            border: "1px solid var(--color-brand-border)",
            color: "var(--color-brand-muted)",
            padding: "0.4rem 0.75rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.85rem",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          ← Dashboard
        </button>
        <h1 style={{
          fontSize: "clamp(1rem, 3vw, 1.5rem)",
          fontWeight: "bold",
          color: "var(--color-brand-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
