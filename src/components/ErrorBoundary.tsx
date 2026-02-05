import { Component, ErrorInfo, ReactNode } from 'react'
import StatusScreen from './StatusScreen'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <StatusScreen
          title="SYSTEM ERROR"
          message="The app ran into a problem and needs to restart."
          details="Try reloading. If the issue persists, check your connection or try again later."
          actionLabel="Reload App"
          onAction={this.handleReload}
          variant="error"
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
