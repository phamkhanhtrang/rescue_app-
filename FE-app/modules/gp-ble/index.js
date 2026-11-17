/**
 * Module native BLE của Guardian Pulse (chỉ Android).
 * Trả về null khi chạy trong Expo Go, trên web hoặc iOS: nơi đó app dùng tầng mô phỏng.
 *
 * API native:
 *   getState(): 'READY' | 'OFF' | 'NO_ADVERTISER' | 'NO_PERMISSION' | 'UNSUPPORTED'
 *   startAdvertising(slot, hex, fast): Promise<boolean>
 *   stopAdvertising(slot): Promise<void>
 *   startScan(): Promise<boolean>     → sự kiện 'onPacket' { hex, rssi }
 *   stopScan(): Promise<void>
 */
import { requireOptionalNativeModule } from 'expo';

export default requireOptionalNativeModule('GpBle');
