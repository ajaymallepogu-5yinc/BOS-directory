import { apiClient } from "./client";
import type { Settings, UpdateSettingsRequest, TestConnectionRequest, TestConnectionResult } from "./types";

export async function fetchSettings(): Promise<Settings> {
  const { data } = await apiClient.get<Settings>("/settings");
  return data;
}

export async function saveSettings(values: UpdateSettingsRequest): Promise<void> {
  await apiClient.post("/settings", values);
}

export async function testSettings(values: TestConnectionRequest): Promise<TestConnectionResult> {
  const { data } = await apiClient.post<TestConnectionResult>("/settings/test", values);
  return data;
}

export async function importSettings(values: TestConnectionRequest): Promise<{ success: boolean; message: string; importedCount: number }> {
  const { data } = await apiClient.post<{ success: boolean; message: string; importedCount: number }>("/settings/import", values);
  return data;
}
