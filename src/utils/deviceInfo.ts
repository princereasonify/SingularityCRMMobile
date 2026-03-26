import DeviceInfo from 'react-native-device-info';

export interface DeviceInfoPayload {
  deviceUniqueId: string;
  deviceBrand: string;
  deviceModel: string;
  deviceOs: string;
  appVersion: string;
  simCarrier: string | null;
  isEmulator: boolean;
}

export async function getDeviceInfo(): Promise<DeviceInfoPayload> {
  const [uniqueId, carrier, isEmulator] = await Promise.all([
    DeviceInfo.getUniqueId(),
    DeviceInfo.getCarrier(),
    DeviceInfo.isEmulator(),
  ]);

  return {
    deviceUniqueId: uniqueId,
    deviceBrand: DeviceInfo.getBrand(),
    deviceModel: DeviceInfo.getModel(),
    deviceOs: `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`,
    appVersion: DeviceInfo.getVersion(),
    simCarrier: carrier || null,
    isEmulator: isEmulator,
  };
}
