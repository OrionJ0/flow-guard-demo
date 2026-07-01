import { STORAGE_KEY, seedScenes } from "../data/workflowFactory";
import { neutralizeScenes } from "../domain/sceneSanitizer";
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

function saveScenes(scenes: ApprovalScene[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(neutralizeScenes(cloneScenes(scenes))));
}

export const mockSceneApi: SceneRepository = {
  async list() {
    await waitForMockLatency();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ApprovalScene[];
        if (Array.isArray(parsed) && parsed.length) {
          const neutralScenes = neutralizeScenes(parsed);
          saveScenes(neutralScenes);
          return neutralScenes;
        }
      }
    } catch (error) {
      console.warn("Failed to read local scenes", error);
    }
    const seeded = seedScenes();
    saveScenes(seeded);
    return seeded;
  },

  async saveAll(scenes) {
    await waitForMockLatency();
    saveScenes(scenes);
  },

  async reset() {
    await waitForMockLatency();
    const seeded = seedScenes();
    saveScenes(seeded);
    return seeded;
  },
};
