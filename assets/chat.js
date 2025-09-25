(function () {
  console.log("📩 Script chat.js carregado...");

  let chatInitialized = false;

  async function authorizeWhatsAppSession(origin, data) {
    try {
      console.log("🔗 Chamando backend para autorização...");
      const response = await fetch("https://api.m.lima/chat/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin,
          data,
        }),
      });

      const result = await response.json();
      console.log("✅ Autorizado:", result);

      if (result?.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank");
      }
    } catch (error) {
      console.error("❌ Erro ao autorizar sessão:", error);
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
      authorizeWhatsAppSession("whatsapp_button", {
        origem: "Botão Flutuante",
        site: "m.lima",
      });
    });

    console.log("✅ Botão WhatsApp existente reaproveitado!");
  }

  /**
   * Inicializa o chat customizado
   */
  function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    console.log("🚀 Inicializando integração do chat...");
    hookExistingWhatsAppButton();
  }

  // espera o DOM estar pronto
  document.addEventListener("DOMContentLoaded", initChat);

  // segurança extra: tenta rodar depois de alguns segundos também
  setTimeout(initChat, 3000);
})();
