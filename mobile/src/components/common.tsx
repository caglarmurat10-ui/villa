import type { ReactNode } from "react";

export function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => <div className="skeleton" key={i} />)}
    </>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="error-state">
      <p>{text}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Tekrar dene</button>}
    </div>
  );
}

export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="top-bar">
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// Ekranlar veri çekerken async durum yönetimini tekrarlamasın diye küçük bir yardımcı.
export function AsyncView<T>({
  loading, error, data, onRetry, empty, children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null;
  onRetry: () => void;
  empty?: boolean;
  children: (data: T) => ReactNode;
}) {
  if (loading) return <Skeleton />;
  if (error) return <ErrorState text={error} onRetry={onRetry} />;
  if (!data || empty) return <EmptyState text="Kayıt bulunamadı." />;
  return <>{children(data)}</>;
}
