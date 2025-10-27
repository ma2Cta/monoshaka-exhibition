// Audio Output Devices APIの型定義
// https://developer.mozilla.org/en-US/docs/Web/API/Audio_Output_Devices_API

interface HTMLMediaElement {
  setSinkId(sinkId: string): Promise<void>;
  readonly sinkId: string;
}

interface MediaDevices {
  selectAudioOutput(options?: AudioOutputOptions): Promise<MediaDeviceInfo>;
}

interface AudioOutputOptions {
  deviceId?: string;
}
