import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('lf_token') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        logout();
      }
    } catch (e) {
      console.error("Auth me error", e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed');
    }
    localStorage.setItem('lf_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const signupTeacher = async (name, email, password, institution) => {
    const res = await fetch('/api/auth/teacher-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, institution })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Signup failed');
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('lf_token');
    setToken('');
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    signupTeacher,
    logout,
    isAdmin: user?.role === 'admin',
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
