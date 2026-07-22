import { apiClient } from "./client";

export interface UserSession {
  id: number;
  fullName: string;
  title: string;
  company: string;
  avatarUrl?: string | null;
  appEmail: string;
  department: string;
  isAdmin: boolean;
  isManager: boolean;
}

export async function loginWithGoogle(idToken: string): Promise<UserSession> {
  const { data } = await apiClient.post<UserSession>("/auth/google-login", { idToken });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function fetchCurrentUser(): Promise<UserSession> {
  const { data } = await apiClient.get<UserSession>("/auth/me");
  return data;
}
