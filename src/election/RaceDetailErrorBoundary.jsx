import React from "react";

export class RaceDetailErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("RaceDetailApp error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 640 }}>
          <h2 style={{ fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)", marginBottom: 8 }}>
            Election monitor failed to load
          </h2>
          <p style={{ fontSize: 14, color: "var(--fs-fg-muted)", marginBottom: 16, lineHeight: 1.5 }}>
            {this.state.error.message || String(this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
              border: "1px solid var(--fs-border)",
              borderRadius: "var(--fs-radius-md)",
              background: "var(--fs-paper)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
