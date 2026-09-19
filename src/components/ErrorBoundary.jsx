import { Component } from 'react'

// Safety net: if ANY render error occurs, show a friendly screen instead
// of a blank white page. This is a React class component — standard pattern.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Nexora crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center px-lg text-center">
          <div className="w-16 h-16 rounded-2xl bg-error/15 border border-error/40 flex items-center justify-center text-error text-h2 font-bold mb-md">
            !
          </div>
          <h1 className="text-h2 text-ink-primary mb-sm">Something went wrong</h1>
          <p className="text-body-small text-ink-secondary mb-lg max-w-[280px] break-words">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary px-lg">
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
