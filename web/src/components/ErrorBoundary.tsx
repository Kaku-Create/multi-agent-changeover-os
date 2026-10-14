import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel" style={{ margin: 24, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#ef4444' }}>页面渲染异常</div>
          <p className="muted" style={{ marginTop: 12 }}>
            {this.state.message || '发生未知错误'}
          </p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
