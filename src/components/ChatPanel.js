import React, { useState, useEffect } from 'react';
import { useMessages } from '../contexts/MessagesContext';
import { formatPhoneNumber } from '../utils/phoneFormatter';
import { sendAgentMessage } from '../services/apiService';

const ChatPanel = ({ selectedConversation, onBackToList, showBackButton }) => {
  const [newMessage, setNewMessage] = useState('');
  const { 
    conversationMessages, 
    loadingMessages, 
    setActiveConversation,
    getConversationMode,
    setConversationMode
  } = useMessages();

  // Obtener mensajes de la conversación actual
  const messages = selectedConversation 
    ? conversationMessages[selectedConversation.id] || []
    : [];
  
  const isLoadingCurrentConversation = selectedConversation 
    ? loadingMessages[selectedConversation.id] || false
    : false;

  // Obtener el modo actual de la conversación
  const currentMode = selectedConversation ? getConversationMode(selectedConversation.id) : 'bot';
  
  // Cargar mensajes cuando cambia la conversación seleccionada
  useEffect(() => {
    if (selectedConversation) {
      console.log(`🎯 ChatPanel: Conversación seleccionada cambiada a ${selectedConversation.id}`);
      setActiveConversation(selectedConversation.id);
    } else {
      console.log('🎯 ChatPanel: No hay conversación seleccionada');
      setActiveConversation(null);
    }
  // eslint-disable-next-line
  }, [selectedConversation?.id, setActiveConversation]); // Solo dependencias estables
  
  // Inicializar modo de conversación por separado
  useEffect(() => {
    if (selectedConversation?.conversation_mode && selectedConversation.id) {
      const storedMode = getConversationMode(selectedConversation.id);
      // Solo establecer si no hay modo almacenado o es diferente
      if (storedMode === 'bot' && selectedConversation.conversation_mode !== 'bot') {
        setConversationMode(selectedConversation.id, selectedConversation.conversation_mode);
      }
    }
  }, [selectedConversation?.id, selectedConversation?.conversation_mode, getConversationMode, setConversationMode]); // Solo cambiar cuando cambie la conversación

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || currentMode === 'bot') return;
    
    const messageToSend = newMessage.trim();
    const waId = selectedConversation.id.replace('conv_', '');
    
    // Limpiar el input inmediatamente para mejor UX
    setNewMessage('');
    
    try {
      console.log('📤 Enviando mensaje del agente:', messageToSend);
      
      const result = await sendAgentMessage(waId, messageToSend);
      
      if (result.success) {
        console.log('✅ Mensaje enviado exitosamente:', result.data);
        // TODO: Aquí podrías actualizar la lista de mensajes localmente
        // o refrescar los mensajes desde el backend
      } else {
        console.error('❌ Error al enviar mensaje:', result.error);
        // TODO: Mostrar notificación de error al usuario
        // Restablecer el mensaje en caso de error
        setNewMessage(messageToSend);
      }
    } catch (error) {
      console.error('❌ Error inesperado al enviar mensaje:', error);
      // Restablecer el mensaje en caso de error
      setNewMessage(messageToSend);
    }
  };

  const handleToggleMode = async () => {
    if (!selectedConversation) return;
    
    const newMode = currentMode === 'bot' ? 'agente' : 'bot';
    
    try {
      const result = await setConversationMode(selectedConversation.id, newMode);
      
      if (result.success) {
        console.log(`✅ Modo cambiado exitosamente a: ${newMode}`);
      } else {
        console.error(`❌ Error al cambiar modo: ${result.error}`);
        // Aquí podrías mostrar una notificación de error al usuario
      }
    } catch (error) {
      console.error(`❌ Error inesperado al cambiar modo:`, error);
    }
  };

  if (!selectedConversation) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">WhatsApp Bot Web</h3>
          <p className="text-gray-500">Selecciona una conversación para comenzar a chatear</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Botón de regreso - solo visible en móvil */}
          {showBackButton && onBackToList && (
            <button
              onClick={onBackToList}
              className="md:hidden text-gray-600 hover:text-gray-800 p-1 rounded-md hover:bg-gray-200 transition-colors"
              title="Volver a conversaciones"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
            {selectedConversation.avatar}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{selectedConversation.name}</h2>
            <p className="text-sm text-gray-500">
              {selectedConversation.phone ? formatPhoneNumber(selectedConversation.phone) : 'Teléfono: No disponible'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {isLoadingCurrentConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">Cargando mensajes...</p>
            </div>
          </div>
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'bot' || message.sender === 'human_agent' 
                  ? 'justify-end' 
                  : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender === 'bot'
                    ? 'bg-blue-500 text-white'
                    : message.sender === 'human_agent'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs ${
                    message.sender === 'bot'
                      ? 'text-blue-100'
                      : message.sender === 'human_agent'
                      ? 'text-green-100'
                      : 'text-gray-500'
                  }`}>
                    {message.timestamp}
                  </p>
                  {/* Mostrar fecha del mensaje */}
                  {message.messageDate && (
                    <span className={`text-xs font-medium ${
                      message.sender === 'bot'
                        ? 'text-blue-200'
                        : message.sender === 'human_agent'
                        ? 'text-green-200'
                        : 'text-gray-600'
                    }`}>
                      {message.messageDate}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : selectedConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>No hay mensajes en esta conversación</p>
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Message input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          {/* Botón de cambio de modo */}
          <button
            type="button"
            onClick={handleToggleMode}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              currentMode === 'agente'
              ? 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
              : 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500'
            }`}
            title={`Cambiar a modo ${currentMode === 'agente' ? 'bot' : 'humano'}`}
          >
            <span className="text-base">
              {currentMode === 'agente' ? '🤖' : '👤'}
            </span>
            <span className="hidden sm:inline">
              {currentMode === 'agente' ? 'Bot' : 'Humano'}
            </span>
          </button>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={currentMode === 'bot' ? 'El bot está activo...' : 'Escribe un mensaje...'}
            disabled={currentMode === 'bot'}
            className={`flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none transition-colors ${
              currentMode === 'bot'
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'focus:ring-2 focus:ring-green-500 focus:border-transparent'
            }`}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || currentMode === 'bot'}
            className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
