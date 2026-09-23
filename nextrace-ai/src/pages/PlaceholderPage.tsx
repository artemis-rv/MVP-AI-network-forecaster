import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 20,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'var(--primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
        }}
      >
        {icon || <Construction size={36} />}
      </div>
      <div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
            marginBottom: 8,
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400 }}>{description}</p>
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 999,
          background: 'var(--primary-light)',
          border: '1px solid var(--primary)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--primary)',
        }}
      >
        <Construction size={14} />
        Coming in the next implementation step
      </div>
    </div>
  );
}
