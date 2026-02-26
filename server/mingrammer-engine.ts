/**
 * Mingrammer Engine Bridge
 * 
 * Spawns the Python mingrammer engine as a child process.
 * The Python engine runs:
 *   1. Knowledge base decision engine (FREE, deterministic)
 *   2. AST-based blueprint slicer
 *   3. Mingrammer renderer → PNG with real cloud icons
 * 
 * Returns: decisions, anti-patterns, PNG path
 */

import { spawn } from "child_process";
import path from "path";

const ENGINE_DIR = path.join(process.cwd(), "server", "engine");
const PYTHON = "python3";

export interface MingrammerResult {
  success: boolean;
  title: string;
  decisions: string[];
  anti_patterns: string[];
  kept: string[];
  removed: string[];
  kept_count: number;
  removed_count: number;
  png_path: string;
  png_filename: string;
  python_source: string;
  diagram: any;  // Full Diagram JSON for editable canvas
  error?: string;
}

/**
 * Generate a mingrammer architecture diagram from a prompt.
 * 
 * @param prompt - User's architecture description
 * @param outputDir - Where to write the PNG
 * @returns MingrammerResult with decisions + PNG path
 */
export async function generateDiagram(
  prompt: string,
  outputDir: string
): Promise<MingrammerResult> {
  return new Promise((resolve, reject) => {
    const generateScript = path.join(ENGINE_DIR, "generate.py");

    const proc = spawn(PYTHON, [generateScript, prompt, outputDir], {
      cwd: ENGINE_DIR,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        // Try to parse error from stdout
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            return reject(new Error(result.error));
          }
        } catch {}
        return reject(new Error(`Engine failed (code ${code}): ${stderr || stdout}`));
      }

      try {
        const result: MingrammerResult = JSON.parse(stdout);
        if (!result.success) {
          return reject(new Error(result.error || "Engine returned failure"));
        }
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse engine output: ${stdout.slice(0, 500)}`));
      }
    });

    proc.on("error", (err: Error) => {
      reject(new Error(`Failed to spawn Python engine: ${err.message}`));
    });

    // 60 second timeout
    setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Engine timeout (60s)"));
    }, 60_000);
  });
}

/**
 * Check if the Python engine is available (python3 + graphviz + diagrams installed)
 */
export async function checkEngine(): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, ["-c", "import diagrams; print('ok')"], {
      timeout: 10_000,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number | null) => {
      if (code === 0 && stdout.trim() === "ok") {
        resolve({ available: true });
      } else {
        resolve({ available: false, error: stderr || "Python diagrams library not found" });
      }
    });
    proc.on("error", (err: Error) => {
      resolve({ available: false, error: `python3 not found: ${err.message}` });
    });
  });
}
