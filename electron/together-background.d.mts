export function holdsBots(dir: string, fs?: unknown): boolean;
export function createTogetherBackground(deps: {
  cloudHome(): boolean;
  togetherOn(): boolean;
  onMyCloud(): boolean;
  ownCopyRuns(): boolean;
  dataDir(): string;
  open(id: string): Promise<boolean>;
  fs?: unknown;
  quietMs?: number;
  later?: typeof setTimeout;
  cancel?: typeof clearTimeout;
  log?(line: string): void;
}): { start(): void; run(): Promise<boolean>; close(): void };
