import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChefHat } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render failed", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
        <section className="w-full max-w-md rounded-[28px] border bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <ChefHat className="mx-auto mb-3 size-12 text-primary" />
          <h1 className="font-display text-3xl font-black">PlateLoop needs a refresh</h1>
          <p className="mt-2 text-sm font-semibold text-secondary">Something failed while rendering this screen. Your saved data is safe.</p>
          <Button className="mt-5 rounded-full" onClick={() => window.location.reload()}>Retry</Button>
        </section>
      </main>
    );
  }
}
