import axios from 'axios';
import { supabase } from './supabase-client';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const orgId = localStorage.getItem('ventapos:orgId');
  const storeId = localStorage.getItem('ventapos:storeId');
  if (orgId) config.headers['X-Organization-Id'] = orgId;
  if (storeId) config.headers['X-Store-Id'] = storeId;
  return config;
});
