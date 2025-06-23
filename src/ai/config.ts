import fs from "fs/promises";
import os from "os";
import path from "path";

export interface AIConfig {
  provider: "openai" | "anthropic" | "google";
  model: string;
  apiKey: string;
}

const CONFIG_FILENAME = ".cocommit-config.json";

export function getConfigFilePath(): string {
  return path.join(os.homedir(), CONFIG_FILENAME);
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  const filePath = getConfigFilePath();
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), { flag: "w" });
}

export async function loadAIConfig(): Promise<AIConfig | null> {
  const filePath = getConfigFilePath();
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}
