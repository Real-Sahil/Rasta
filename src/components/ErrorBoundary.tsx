/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from '../services/errorReporting';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('react', error, info.componentStack ?? undefined);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-slate-900 text-white">
        <p className="text-lg font-semibold">Something went wrong / کچھ غلط ہو گیا</p>
        <p className="text-sm text-slate-300 max-w-sm">The problem was reported automatically. Reload to continue. / مسئلہ خود بخود رپورٹ ہو گیا ہے۔ جاری رکھنے کے لیے دوبارہ لوڈ کریں۔</p>
        <button className="px-5 py-2 rounded-xl bg-emerald-600 font-semibold" onClick={() => location.reload()}>Reload / دوبارہ لوڈ کریں</button>
      </div>
    );
  }
}
