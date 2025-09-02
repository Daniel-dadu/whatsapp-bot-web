import React, { createContext, useContext, useState, useEffect } from 'react';
import { getRecentContacts, loginRequest } from '../services/apiService';
import { formatContactForUI } from '../services/contactsService';

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

  // Check if user has a valid JWT token
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          // Verificar si el token no ha expirado
          const payload = JSON.parse(atob(token.split('.')[1]));
          const now = Math.floor(Date.now() / 1000);
          
          if (payload.exp && payload.exp > now) {
            setIsAuthenticated(true);
            // Cargar contactos automáticamente al detectar sesión válida
            await loadRecentContacts();
          } else {
            // Token expirado, limpiar
            localStorage.removeItem('access_token');
            localStorage.removeItem('token_type');
            localStorage.removeItem('expires_in');
          }
        } catch (error) {
          // Token inválido, limpiar
          console.error('Token inválido:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('token_type');
          localStorage.removeItem('expires_in');
        }
      }
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (username, password) => {
    try {
      // Validating credentials in backend
      const response = await loginRequest(username, password);

      if (response.ok) {
        const data = await response.json();
        
        if (data.access_token) {
          // Guardar token JWT y información relacionada
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('token_type', data.token_type || 'Bearer');
          if (data.expires_in) {
            localStorage.setItem('expires_in', data.expires_in);
          }
          
          console.log('✅ Login exitoso, token JWT guardado');
          setIsAuthenticated(true);
          
          // Cargar contactos automáticamente al hacer login
          await loadRecentContacts();
          return true;
        } else {
          console.error('Error en login: No se recibió access_token');
          return false;
        }
      } else {
        const errorData = await response.text().catch(() => 'Error desconocido');
        console.error('Error en login:', response.status, errorData);
        return false;
      }
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
      return false;
    }
  };

  const logout = () => {
    // Limpiar todos los datos de autenticación
    localStorage.removeItem('lastLogin');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_in');
    
    setIsAuthenticated(false);
    setContacts([]); // Limpiar contactos al hacer logout
    
    console.log('🚪 Logout realizado, tokens JWT eliminados');
    
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
