import axios from "axios";

// In production, set VITE_API_BASE_URL at build time to point at the deployed API.
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5226/api";

export const apiClient = axios.create({ 
  baseURL,
  withCredentials: true
});
