/**
 * Push-device domain models (API_CONTRACT.md §11, R15; FSD §5.6 NT-3). Transport-
 * and store-agnostic. A device registers its FCM/APNs token so OS push can reach
 * the user when the app is backgrounded; the in-app feed remains the history.
 */

export type DevicePlatform = 'android' | 'ios' | 'web';

export interface RegisterDeviceCommand {
  /** FCM/APNs registration token for this device. */
  token: string;
  platform: DevicePlatform;
}
