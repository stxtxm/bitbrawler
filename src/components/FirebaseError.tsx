import React, { memo } from 'react';

interface FirebaseErrorProps {
  onRetry?: () => void;
}

const FirebaseError: React.FC<FirebaseErrorProps> = memo(({ onRetry }) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#1a1a1a',
      color: '#fff',
      fontFamily: 'Press Start 2P, monospace'
    }}>
      <div style={{
        maxWidth: '600px',
        backgroundColor: '#2a2a2a',
        padding: '30px',
        borderRadius: '10px',
        border: '2px solid #ff4444'
      }}>
        <h2 style={{ 
          color: '#ff4444', 
          marginBottom: '20px',
          fontSize: '18px'
        }}>
          ⚠️ CONNECTION ERROR
        </h2>
        
        <p style={{ 
          marginBottom: '20px',
          fontSize: '12px',
          lineHeight: '1.5'
        }}>
          Unable to connect to the game servers. 
          Please check your internet connection and try again.
        </p>
        
        <p style={{ 
          marginBottom: '25px',
          fontSize: '10px',
          color: '#ccc',
          lineHeight: '1.4'
        }}>
          Your progress is saved online. 
          Playing without connection could cause data loss.
        </p>
        
        <button
          onClick={handleRetry}
          style={{
            backgroundColor: '#ff4444',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            fontSize: '10px',
            fontFamily: 'Press Start 2P, monospace',
            cursor: 'pointer',
            borderRadius: '5px',
            textTransform: 'uppercase',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#ff6666';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#ff4444';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
});

FirebaseError.displayName = 'FirebaseError';

export default FirebaseError;
