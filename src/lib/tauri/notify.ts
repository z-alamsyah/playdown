import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let granted: boolean | null = null;

/** Fire a native OS notification (permission requested lazily, cached). */
export async function notifyNative(title: string, body: string) {
  try {
    if (granted === null) {
      granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
    }
    if (granted) sendNotification({ title, body });
  } catch (e) {
    console.error("Notification failed:", e);
  }
}
