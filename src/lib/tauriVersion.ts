import { getTauriVersion } from '@tauri-apps/api/app';

import { isTauriRuntime } from './runtime';

/** SatX requires Tauri 2.0+ when running in the desktop shell. */
export async function assertTauri2Runtime(): Promise<void> {
  if (!isTauriRuntime()) return;

  const version = await getTauriVersion();
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (!Number.isFinite(major) || major < 2) {
    throw new Error(
      `SatX requires Tauri 2.0 or newer (runtime reported ${version}).`,
    );
  }
}
