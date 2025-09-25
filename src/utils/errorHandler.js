class ErrorHandler {
  static handle(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    // Determine error type and show appropriate message
    let userMessage = 'Ocorreu um erro inesperado. Tente novamente.';
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      userMessage = 'Problema de conexão. Verifique sua internet e tente novamente.';
    } else if (error.message.includes('404')) {
      userMessage = 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.';
    } else if (error.message.includes('500')) {
      userMessage = 'Erro interno do servidor. Nossa equipe foi notificada.';
    } else if (error.message.includes('timeout')) {
      userMessage = 'A requisição demorou muito para responder. Tente novamente.';
    }
    
    return userMessage;
  }
  
  static showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ff4757' : '#2ed573'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 100000;
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

export default ErrorHandler;