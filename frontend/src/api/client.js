import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL;
const ACCESS_TOKEN_KEY = 'loan_app_access_token';
const REFRESH_TOKEN_KEY = 'loan_app_refresh_token';
const LEGACY_TOKEN_KEY = 'loan_app_token';
const USER_KEY = 'loan_app_user';

export const api = axios.create({
  baseURL: API_URL,
});

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthSession({ accessToken, refreshToken, user }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest?._retry && getRefreshToken()) {
      originalRequest._retry = true;
      try {
        refreshPromise =
          refreshPromise ||
          axios.post(`${API_URL}/auth/refresh`, {
            refreshToken: getRefreshToken(),
          });
        const response = await refreshPromise;
        refreshPromise = null;
        setAuthSession(response.data);
        originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        clearAuthSession();
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      clearAuthSession();
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return message || error.message || 'Something went wrong';
}
