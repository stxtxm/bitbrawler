import StatusScreen from './StatusScreen'

interface LoadingScreenProps {
  message?: string
}

const LoadingScreen = ({ message = 'PLEASE WAIT' }: LoadingScreenProps) => {
  return (
    <StatusScreen
      title="LOADING..."
      message={message}
      variant="warning"
      showLoader
    />
  )
}

export default LoadingScreen
