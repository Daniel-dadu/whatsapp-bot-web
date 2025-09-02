import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getCachedConversationMessages, 
  clearConversationsCache,
  getCacheStats 
} from '../services/messagesService';
import { changeConversationMode, getRecentMessages, getRecentContacts } from '../services/apiService';
import { formatContactForUI } from '../services/contactsService';

const MessagesContext = createContext();

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};

export const MessagesProvider = ({ children }) => {
  // Estado para manejar mensajes de conversaciones
  const [conversationMessages, setConversationMessages] = useState({});
  const [loadingMessages, setLoadingMessages] = useState({});
  const [errorMessages, setErrorMessages] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationModes, setConversationModes] = useState({}); // Estado para modos de conversación
  
  // Estado para manejar contactos
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  
  // Referencias para manejar el polling
  const pollingIntervalRef = useRef(null);
  const POLLING_INTERVAL = 15000; // 15 segundos

  // Función para cargar contactos recientes
  const loadRecentContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const response = await getRecentContacts();
      if (response.success) {
        const formattedContacts = response.data.map(lead => formatContactForUI(lead, conversationMessages));
        setContacts(formattedContacts);
      } else {
        console.error('Error al cargar contactos:', response.error);
      }
    } catch (error) {
      console.error('Error al cargar contactos:', error);
    } finally {
      setLoadingContacts(false);
    }
  // eslint-disable-next-line
  }, []); // Remover conversationMessages de las dependencias para evitar re-renders

  /**
   * Carga los mensajes de una conversación específica
   * @param {string} conversationId - ID de la conversación
   * @param {boolean} forceRefresh - Forzar recarga desde backend
   */
  const loadConversationMessages = useCallback(async (conversationId, forceRefresh = false) => {
    if (!conversationId) return;

    console.log(`📱 Cargando mensajes para conversación: ${conversationId}`);
    
    // Marcar como cargando
    setLoadingMessages(prev => ({ ...prev, [conversationId]: true }));

    try {
      const result = await getCachedConversationMessages(conversationId, forceRefresh);
      
      if (result.success) {
        setConversationMessages(prev => ({
          ...prev,
          [conversationId]: result.messages
        }));
        
        // Si hay información del modo de conversación, actualizarla
        if (result.conversationMode) {
          setConversationModes(prev => ({
            ...prev,
            [conversationId]: result.conversationMode
          }));
        }
        
        // Limpiar cualquier error previo
        setErrorMessages(prev => {
          const newState = { ...prev };
          delete newState[conversationId];
          return newState;
        });
        
        if (result.fromCache) {
          console.log(`💾 Mensajes cargados desde caché para: ${conversationId}`);
        } else {
          console.log(`🌐 Mensajes cargados desde backend para: ${conversationId}`);
        }
      } else {
        // Marcar como error para evitar intentos futuros
        setErrorMessages(prev => ({
          ...prev,
          [conversationId]: result.error || 'Error al cargar mensajes'
        }));
        
        // Si es un error previo, no mostrar el log repetidamente
        if (!result.previouslyFailed) {
          console.error(`❌ Error al cargar mensajes para ${conversationId}:`, result.error);
        }
        
        // Asegurar que haya un array vacío para esta conversación
        setConversationMessages(prev => ({
          ...prev,
          [conversationId]: []
        }));
      }
    } catch (error) {
      console.error(`❌ Error inesperado al cargar mensajes:`, error);
      setErrorMessages(prev => ({
        ...prev,
        [conversationId]: 'Error inesperado'
      }));
      setConversationMessages(prev => ({
        ...prev,
        [conversationId]: []
      }));
    } finally {
      // Quitar indicador de carga
      setLoadingMessages(prev => ({ ...prev, [conversationId]: false }));
    }
  }, []); // Sin dependencias ya que usa solo setters estables

  /**
   * Formatea un mensaje para mostrar correctamente en la UI
   * @param {Object} message - Mensaje del backend
   * @returns {Object} - Mensaje formateado
   */
  const formatMessageForUI = useCallback((message) => {
    const timestamp = new Date(message.timestamp);
    return {
      ...message,
      timestamp: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messageDate: timestamp.toLocaleDateString()
    };
  }, []);

  /**
   * Actualiza los mensajes de una conversación con nuevos mensajes (para uso futuro con polling)
   * @param {string} conversationId - ID de la conversación
   * @param {Array} newMessages - Array de mensajes nuevos del backend
   */
  const updateConversationWithNewMessages = useCallback((conversationId, newMessages) => {
    if (!conversationId || !Array.isArray(newMessages)) {
      console.error('❌ Parámetros inválidos para updateConversationWithNewMessages:', { conversationId, newMessages });
      return;
    }

    console.log(`🔄 Actualizando conversación ${conversationId} con ${newMessages.length} mensajes nuevos`);

    setConversationMessages(prev => {
      const currentMessages = prev[conversationId] || [];
      
      // Combinar mensajes existentes con nuevos, evitando duplicados
      const existingIds = new Set(currentMessages.map(msg => msg.id));
      const uniqueNewMessages = newMessages
        .filter(msg => !existingIds.has(msg.id))
        .map(msg => formatMessageForUI(msg)); // Formatear cada mensaje nuevo

      return {
        ...prev,
        [conversationId]: [...currentMessages, ...uniqueNewMessages]
      };
    });

    // Actualizar contactos con los nuevos mensajes
    setContacts(prev => prev.map(contact => {
      if (contact.id === conversationId) {
        const updatedContact = formatContactForUI(contact.originalData, {
          ...conversationMessages,
          [conversationId]: [...(conversationMessages[conversationId] || []), ...newMessages]
        });
        return {
          ...contact,
          lastMessage: updatedContact.lastMessage
        };
      }
      return contact;
    }));
  }, [formatMessageForUI, conversationMessages]); // Incluir la función de formateo como dependencia

  /**
   * Realiza polling para obtener mensajes nuevos de una conversación
   * @param {string} conversationId - ID de la conversación
   */
  const pollForNewMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;

    const waId = conversationId.replace('conv_', '');
    
    // Usar setConversationMessages para acceder al estado actual
    let shouldContinuePolling = false;
    let lastMessageId = null;
    
    setConversationMessages(currentState => {
      const currentMessages = currentState[conversationId] || [];
      
      // No hacer polling si no hay mensajes cargados aún
      if (currentMessages.length === 0) {
        console.log(`📡 Polling omitido para ${conversationId} - no hay mensajes cargados aún`);
        return currentState; // No cambiar el estado
      }
      
      shouldContinuePolling = true;
      lastMessageId = currentMessages[currentMessages.length - 1].id;
      return currentState; // No cambiar el estado
    });
    
    if (!shouldContinuePolling) return;

    try {
      console.log(`📡 Polling: ejecutando polling para ${conversationId}`);
      const result = await getRecentMessages(waId, lastMessageId);
      
      if (result.success && result.data.messages && result.data.messages.length > 0) {
        console.log(`📡 Polling: ${result.data.messages.length} mensajes nuevos para ${conversationId}`);
        
        // Actualizar mensajes usando la función existente
        updateConversationWithNewMessages(conversationId, result.data.messages);
        
        // Actualizar modo de conversación si cambió
        if (result.data.conversation_mode) {
          const currentMode = conversationModes[conversationId];
          if (currentMode !== result.data.conversation_mode) {
            setConversationModes(prev => ({
              ...prev,
              [conversationId]: result.data.conversation_mode
            }));
          }
        }
      } else if (!result.success && result.error === 'Token expirado') {
        // Si el token expiró durante el polling, detener el polling sin recargar la página
        console.log('⏹️ Deteniendo polling - token expirado');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error(`❌ Error en polling para ${conversationId}:`, error);
      // No hacer nada más para evitar que el polling cause problemas
    }
  }, [conversationModes, updateConversationWithNewMessages]);

  /**
   * Configura el sistema de polling para la conversación activa
   * @param {string} conversationId - ID de la conversación para hacer polling
   */
  const setupPolling = useCallback((conversationId) => {
    // Limpiar polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Si no hay conversación activa, no hacer polling
    if (!conversationId) {
      console.log('⏹️ Deteniendo polling - no hay conversación activa');
      return;
    }

    console.log(`⏰ Iniciando polling cada ${POLLING_INTERVAL/1000}s para conversación: ${conversationId}`);
    
    // Configurar nuevo polling
    pollingIntervalRef.current = setInterval(() => {
      pollForNewMessages(conversationId);
    }, POLLING_INTERVAL);
  }, [pollForNewMessages]); // Depende de la función de polling
  
  /**
   * Establece la conversación activa y maneja el polling
   * @param {string} conversationId - ID de la conversación activa
   * @param {Object} conversationData - Datos completos de la conversación (opcional)
   */
  const setActiveConversation = useCallback(async (conversationId, conversationData = null) => {
    console.log(`🎯 Estableciendo conversación activa: ${conversationId}`);
    
    // Actualizar conversación activa
    setActiveConversationId(conversationId);
    
    // Si se proporcionan datos de la conversación, inicializar el modo solo si no existe
    if (conversationData && conversationData.conversationMode) {
      const currentMode = conversationModes[conversationId];
      // Solo actualizar si no existe el modo actual (primera carga)
      if (!currentMode) {
        console.log(`🔧 Inicializando modo desde datos de conversación: ${conversationId} -> ${conversationData.conversationMode}`);
        setConversationModes(prev => ({
          ...prev,
          [conversationId]: conversationData.conversationMode
        }));
      }
    }
    
    // Cargar mensajes si no los tenemos y no han fallado previamente
    if (conversationId && !conversationMessages[conversationId] && !errorMessages[conversationId]) {
      await loadConversationMessages(conversationId);
      // Configurar polling después de cargar los mensajes
      setTimeout(() => setupPolling(conversationId), 1000);
    } else {
      // Si ya hay mensajes, configurar polling inmediatamente
      setupPolling(conversationId);
    }
  // eslint-disable-next-line
  }, [conversationMessages, errorMessages, loadConversationMessages, setupPolling]); // Incluir dependencias necesarias

  /**
   * Cambia el modo de conversación (bot/agente)
   * @param {string} conversationId - ID de la conversación
   * @param {string} mode - Nuevo modo ('bot' o 'agente')
   */
  const setConversationMode = useCallback(async (conversationId, mode) => {
    if (!conversationId || (mode !== 'bot' && mode !== 'agente')) {
      console.error('❌ Parámetros inválidos para setConversationMode:', { conversationId, mode });
      return { success: false, error: 'Parámetros inválidos' };
    }
    
    console.log(`🔄 Cambiando modo de conversación ${conversationId} a: ${mode}`);
    
    // Extraer wa_id del conversationId (remover prefijo 'conv_' si existe)
    const waId = conversationId.replace('conv_', '');
    
    try {
      const result = await changeConversationMode(waId, mode);
      
      if (result.success) {
        // Solo actualizar el estado local si la llamada al backend fue exitosa
        setConversationModes(prev => ({
          ...prev,
          [conversationId]: mode
        }));
        
        console.log(`✅ Modo cambiado exitosamente a: ${mode}`);
        return { success: true, data: result.data };
      } else {
        console.error(`❌ Error al cambiar modo: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error(`❌ Error inesperado al cambiar modo:`, error);
      return { success: false, error: 'Error inesperado al cambiar modo' };
    }
  }, []); // Sin dependencias ya que solo usa setters estables

  /**
   * Obtiene el modo actual de una conversación
   * @param {string} conversationId - ID de la conversación
   * @returns {string} - 'bot' o 'agente'
   */
  const getConversationMode = useCallback((conversationId) => {
    return conversationModes[conversationId] || 'bot'; // Por defecto en modo bot
  }, [conversationModes]); // Depende del estado de modos

  /**
   * Agrega un mensaje local a una conversación
   * @param {string} conversationId - ID de la conversación
   * @param {Object} message - Objeto del mensaje con text, sender, etc.
   */
  const addMessageToConversation = useCallback((conversationId, message) => {
    if (!conversationId || !message) {
      console.error('❌ Parámetros inválidos para addMessageToConversation:', { conversationId, message });
      return;
    }

    console.log(`📝 Agregando mensaje local a conversación ${conversationId}:`, message);

    setConversationMessages(prev => ({
      ...prev,
      [conversationId]: [
        ...(prev[conversationId] || []),
        message
      ]
    }));
  }, []); // Sin dependencias ya que usa solo setters estables

  /**
   * Limpia todos los datos al hacer logout
   */
  const clearAllMessages = useCallback(() => {
    console.log('🧹 Limpiando todos los mensajes y caché');
    
    // Detener polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Limpiar estado local
    setConversationMessages({});
    setLoadingMessages({});
    setErrorMessages({});
    setActiveConversationId(null);
    setConversationModes({});
    setContacts([]); // Limpiar contactos también
    
    // Limpiar caché del servicio
    clearConversationsCache();
  }, []); // Sin dependencias ya que usa refs y setters estables

  /**
   * Obtiene estadísticas de caché para debugging
   */
  const getDebugInfo = () => {
    const cacheStats = getCacheStats();
    return {
      ...cacheStats,
      localConversations: Object.keys(conversationMessages),
      activeConversation: activeConversationId,
      pollingActive: !!pollingIntervalRef.current
    };
  };

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Debug: mostrar estadísticas cada 30 segundos en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const debugInterval = setInterval(() => {
        const debugInfo = getDebugInfo();
        console.log('📊 [DEBUG] Estado del MessagesContext:', debugInfo);
      }, 30000);

      return () => clearInterval(debugInterval);
    }
  // eslint-disable-next-line
  }, []);

  const value = {
    // Estado
    conversationMessages,
    loadingMessages,
    errorMessages,
    activeConversationId,
    conversationModes,
    contacts,
    loadingContacts,
    
    // Acciones
    loadConversationMessages,
    setActiveConversation,
    setConversationMode,
    getConversationMode,
    addMessageToConversation,
    updateConversationWithNewMessages,
    pollForNewMessages,
    clearAllMessages,
    loadRecentContacts,
    
    // Utilidades
    getDebugInfo
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};
