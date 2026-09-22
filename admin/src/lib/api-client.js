import axios from 'axios';
import { supabase } from './supabase-client';
// Admin console is platform-scoped: Bearer only, no tenant org/store headers.
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
});
api.interceptors.request.use(async (config) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
