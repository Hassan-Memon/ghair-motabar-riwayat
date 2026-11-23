/**
 * Background content check, at most every 12 hours (the OS decides when; iOS may rarely run
 * it). The launch check is the real path; this is a bonus. Must be imported at module scope
 * of the root layout so the task is defined before the OS wakes the app.
 */
import { initUserDb } from '@tehqeqat/core';
import * as BackgroundTask from 'expo-background-task';
import * as SQLite from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';

import { ExpoDb } from '@/db/expoAdapter';

import { refreshContent } from './refresh';

export const CONTENT_TASK = 'tehqeqat-content-refresh';

TaskManager.defineTask(CONTENT_TASK, async () => {
  try {
    const user = new ExpoDb(await SQLite.openDatabaseAsync('user.db'));
    await initUserDb(user);
    const r = await refreshContent(user, 'background');
    return r === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerContentTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(CONTENT_TASK)) return;
    await BackgroundTask.registerTaskAsync(CONTENT_TASK, { minimumInterval: 12 * 60 });
  } catch {
    // not available on this device (simulator, restricted): the launch check still runs
  }
}
