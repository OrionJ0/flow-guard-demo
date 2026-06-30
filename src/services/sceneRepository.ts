import { STORAGE_KEY, seedScenes } from "../data/workflowFactory";
import type { ApprovalScene } from "../types";

export interface SceneRepository {
  list(): Promise<ApprovalScene[]>;
  saveAll(scenes: ApprovalScene[]): Promise<void>;
  reset(): Promise<ApprovalScene[]>;
}

const MOCK_LATENCY_MS = 120;

function waitForMockLatency() {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_LATENCY_MS));
}

function cloneScenes(scenes: ApprovalScene[]): ApprovalScene[] {
  return JSON.parse(JSON.stringify(scenes)) as ApprovalScene[];
}

export const mockSceneApi: SceneRepository = {
  async list() {
    await waitForMockLatency();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ApprovalScene[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (error) {
      console.warn("Failed to read local scenes", error);
    }
    const seeded = seedScenes();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  },

  async saveAll(scenes) {
    await waitForMockLatency();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneScenes(scenes)));
  },

  async reset() {
    await waitForMockLatency();
    const seeded = seedScenes();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  },
};
