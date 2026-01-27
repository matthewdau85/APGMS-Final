import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: string;
  stack?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(err: unknown): State {
    const e = err instanceof Error ? err : new Error(String(err));
    return {
      hasError: true,
      error: e.message || String(e),
      stack: e.stack,
    };
  }

  public componentDidCatch(err: unknown, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("React error boundary caught:", err, info);
  }

  public render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>APGMS Webapp</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>UI crashed (render error)</div>
          <p style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.45 }}>
            The app hit a runtime error. The details below are safe to copy/paste back into chat.
          </p>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Message</div>
            <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
{this.state.error || "(no message)"}
            </pre>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Stack</div>
            <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
{this.state.stack || "(no stack)"}
            </pre>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.85 }}>
            Tip: if you only saw a blank screen before, this boundary will now show the real error.
          </div>
        </div>
      </div>
    );
  }
}
