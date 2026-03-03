import { NativeModules, Platform } from "react-native";

type NativeAlarmPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

type NativeAlarmModule = {
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<void>;
  scheduleExactAlarm(
    alarmId: string,
    triggerAtMillis: number,
    title: string,
    body: string,
    channelId: string,
    soundName: string,
    payloadJson: string,
  ): Promise<string>;
  cancelAlarm(alarmId: string): Promise<void>;
  cancelAllAlarms(): Promise<void>;
};

const nativeModule = NativeModules.NotiMedAlarmModule as
  | NativeAlarmModule
  | undefined;

function normalizePayload(payload: NativeAlarmPayload) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value == null ? "" : String(value)]),
  );
}

export const androidAlarm = {
  isAvailable: Platform.OS === "android" && !!nativeModule,

  canScheduleExactAlarms() {
    if (!this.isAvailable || !nativeModule) return Promise.resolve(false);
    return nativeModule.canScheduleExactAlarms();
  },

  openExactAlarmSettings() {
    if (!this.isAvailable || !nativeModule) return Promise.resolve();
    return nativeModule.openExactAlarmSettings();
  },

  canUseFullScreenIntent() {
    if (!this.isAvailable || !nativeModule) return Promise.resolve(false);
    return nativeModule.canUseFullScreenIntent();
  },

  openFullScreenIntentSettings() {
    if (!this.isAvailable || !nativeModule) return Promise.resolve();
    return nativeModule.openFullScreenIntentSettings();
  },

  scheduleExactAlarm(options: {
    alarmId: string;
    triggerAtMillis: number;
    title: string;
    body: string;
    channelId: string;
    soundName: string;
    data: NativeAlarmPayload;
  }) {
    if (!this.isAvailable || !nativeModule) {
      return Promise.reject(new Error("Android alarm module is unavailable."));
    }

    return nativeModule.scheduleExactAlarm(
      options.alarmId,
      options.triggerAtMillis,
      options.title,
      options.body,
      options.channelId,
      options.soundName,
      JSON.stringify(normalizePayload(options.data)),
    );
  },

  cancelAlarm(alarmId: string) {
    if (!this.isAvailable || !nativeModule) return Promise.resolve();
    return nativeModule.cancelAlarm(alarmId);
  },

  cancelAllAlarms() {
    if (!this.isAvailable || !nativeModule) return Promise.resolve();
    return nativeModule.cancelAllAlarms();
  },
};
