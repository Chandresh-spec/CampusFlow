export const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    return token && token !== 'undefined' && token !== 'null' ? token : null;
  }
  return null;
};

export const getRefreshToken = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('refresh_token');
    return token && token !== 'undefined' && token !== 'null' ? token : null;
  }
  return null;
};

export const setTokens = (access: string, refresh: string) => {
  if (typeof window !== 'undefined') {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  }
};

export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};

export const getUser = () => {
  if (typeof window !== 'undefined') {
    try {
      const user = localStorage.getItem('user');
      if (!user || user === 'undefined' || user === 'null') return null;
      return JSON.parse(user);
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const setUser = (user: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const clearUser = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
  }
};

export const decodeJWT = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const isTokenExpired = (token: string) => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
};
