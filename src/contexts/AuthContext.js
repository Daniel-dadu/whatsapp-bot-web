import React, { createContext, useContext, useState, useEffect } from 'react';
import { getRecentContacts, formatContactForUI } from '../services/apiService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Función para cargar contactos recientes
  const loadRecentContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await getRecentContacts();
      if (response.success) {
        const formattedContacts = response.data.map(lead => formatContactForUI(lead, {}));
        setContacts(formattedContacts);
      } else {
        console.error('Error al cargar contactos:', response.error);
      }
    } catch (error) {
      console.error('Error al cargar contactos:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Check if user has a valid login from today
  useEffect(() => {
    const checkAuthStatus = async () => {
      const lastLogin = localStorage.getItem('lastLogin');
      if (lastLogin) {
        const today = new Date().toDateString();
        const loginDate = new Date(lastLogin).toDateString();
        
        if (loginDate === today) {
          setIsAuthenticated(true);
          // Cargar contactos automáticamente al detectar sesión válida
          await loadRecentContacts();
        }
      }
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (username, password) => {
    // Simple validation - in a real app this would connect to backend
    if (username && password) {
      const today = new Date().toISOString();
      localStorage.setItem('lastLogin', today);
      setIsAuthenticated(true);
      // Cargar contactos automáticamente al hacer login
      await loadRecentContacts();
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('lastLogin');
    setIsAuthenticated(false);
    setContacts([]); // Limpiar contactos al hacer logout
    
    // NOTA: Los mensajes se limpiarán desde el ChatApp cuando detecte el logout
    // No podemos importar useMessages aquí para evitar dependencias circulares
  };

  const value = {
    isAuthenticated,
    login,
    logout,
    loading,
    contacts,
    loadingContacts,
    loadRecentContacts
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
