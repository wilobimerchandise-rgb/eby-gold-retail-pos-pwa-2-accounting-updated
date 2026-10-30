import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: unknown): void {
    console.error("ErrorBoundary caught", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: "" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <AlertTriangle className="text-rose-600" size={28} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-4">
              The app hit an unexpected error. Your data is safe. Reloading usually fixes it.
            </p>
            <pre className="text-xs text-left bg-slate-50 rounded-lg p-3 mb-4 text-slate-600 overflow-x-auto">
              {this.state.message}
            </pre>
            <button
              onClick={this.handleReload}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold active:scale-[0.98] transition-transform"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
