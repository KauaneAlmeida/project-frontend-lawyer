(function () {
  console.log("📩 Script chat.js carregado...");

  let chatInitialized = false;

  // Import the ChatBot class
  async function loadChatBot() {
    try {
      const { default: ChatBot } = await import('./src/components/ChatBot.js');
      return ChatBot;
    } catch (error) {
      console.error('Failed to load ChatBot:', error);
      return null;
    }
  }

  /**
   * Função para "plugar" no botão flutuante já existente do React
   * Não cria clone nem usa insertBefore -> evita erro no DOM
   */
  function hookExistingWhatsAppButton() {
    const button = document.querySelector('[data-testid="floating-whatsapp-button"]');
    if (!button) {
      console.warn("⚠️ Botão do WhatsApp não encontrado ainda.");
      return;
    }

    // remove handlers antigos clonando o nó
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    // agora pluga só a lógica customizada
    newButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("🔥 Botão WhatsApp clicado!");
      
      // Use the ChatBot's WhatsApp integration
      if (window.chatBot) {
        window.chatBot.handleWhatsAppFloatingButton();
      }
    });

    console.log("✅ Botão WhatsApp existente reaproveitado!");
  }

  /**
   * Inicializa o chat customizado
   */
  async function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    console.log("🚀 Inicializando integração do chat...");
    
    // Load and initialize ChatBot
    await loadChatBot();
    
    // Hook existing WhatsApp button
    hookExistingWhatsAppButton();
  }

  // espera o DOM estar pronto
  document.addEventListener("DOMContentLoaded", initChat);

  // segurança extra: tenta rodar depois de alguns segundos também
  setTimeout(initChat, 3000);
})();