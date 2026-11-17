package expo.modules.gpble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Phát và quét gói tin 0xGP qua BLE Advertising (không kết nối, không GATT).
 *
 * Gói tin 20 bytes nằm trong Service Data của UUID 16-bit 0x4750. Mỗi "slot" là một
 * bộ quảng bá độc lập: slot "sos" phát phao cứu sinh liên tục, slot "tx" phát tạm
 * lệnh PING / tin nhắn. Quyền runtime do phía JavaScript xin trước khi gọi.
 */
@SuppressLint("MissingPermission")
class GpBleModule : Module() {
  private val serviceUuid: ParcelUuid = ParcelUuid.fromString("00004750-0000-1000-8000-00805f9b34fb")
  private val magicPrefix = byteArrayOf(0x47, 0x50)

  private val advertiseCallbacks = HashMap<String, AdvertiseCallback>()
  private var scanCallback: ScanCallback? = null

  override fun definition() = ModuleDefinition {
    Name("GpBle")

    Events("onPacket", "onScanFailed")

    Function("getState") {
      currentState()
    }

    AsyncFunction("startAdvertising") { slot: String, hex: String, fast: Boolean, promise: Promise ->
      startAdvertising(slot, hex, fast, promise)
    }

    AsyncFunction("stopAdvertising") { slot: String ->
      stopAdvertising(slot)
    }

    AsyncFunction("startScan") { promise: Promise ->
      startScan(promise)
    }

    AsyncFunction("stopScan") {
      stopScan()
    }

    OnDestroy {
      stopScan()
      advertiseCallbacks.keys.toList().forEach { stopAdvertising(it) }
    }
  }

  private fun adapter(): BluetoothAdapter? {
    val context = appContext.reactContext ?: return null
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun currentState(): String {
    return try {
      val bluetooth = adapter()
      when {
        bluetooth == null -> "UNSUPPORTED"
        !bluetooth.isEnabled -> "OFF"
        bluetooth.bluetoothLeAdvertiser == null -> "NO_ADVERTISER"
        else -> "READY"
      }
    } catch (e: SecurityException) {
      "NO_PERMISSION"
    }
  }

  private fun startAdvertising(slot: String, hex: String, fast: Boolean, promise: Promise) {
    try {
      val bluetooth = adapter()
      val advertiser = if (bluetooth != null && bluetooth.isEnabled) bluetooth.bluetoothLeAdvertiser else null
      if (advertiser == null) {
        promise.reject("E_BLE_UNAVAILABLE", "Bluetooth đang tắt hoặc máy không hỗ trợ phát BLE.", null)
        return
      }
      val payload = hexToBytes(hex)
      if (payload.size < 16 || payload.size > 24) {
        promise.reject("E_BLE_PAYLOAD", "Gói tin phải dài 16–24 bytes.", null)
        return
      }

      advertiseCallbacks.remove(slot)?.let { previous ->
        try { advertiser.stopAdvertising(previous) } catch (_: Exception) {}
      }

      val settings = AdvertiseSettings.Builder()
        .setAdvertiseMode(
          if (fast) AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY else AdvertiseSettings.ADVERTISE_MODE_BALANCED
        )
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
        .setConnectable(false)
        .setTimeout(0)
        .build()

      val data = AdvertiseData.Builder()
        .setIncludeDeviceName(false)
        .setIncludeTxPowerLevel(false)
        .addServiceData(serviceUuid, payload)
        .build()

      val callback = object : AdvertiseCallback() {
        private var settled = false

        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
          if (!settled) {
            settled = true
            promise.resolve(true)
          }
        }

        override fun onStartFailure(errorCode: Int) {
          if (advertiseCallbacks[slot] === this) {
            advertiseCallbacks.remove(slot)
          }
          if (!settled) {
            settled = true
            promise.reject("E_BLE_ADVERTISE", "Không phát được BLE (mã lỗi $errorCode).", null)
          }
        }
      }

      advertiseCallbacks[slot] = callback
      advertiser.startAdvertising(settings, data, callback)
    } catch (e: SecurityException) {
      promise.reject("E_BLE_PERMISSION", "Chưa cấp quyền Bluetooth.", e)
    } catch (e: Exception) {
      promise.reject("E_BLE_ADVERTISE", e.message ?: "Lỗi phát BLE.", e)
    }
  }

  private fun stopAdvertising(slot: String) {
    val callback = advertiseCallbacks.remove(slot) ?: return
    try {
      adapter()?.bluetoothLeAdvertiser?.stopAdvertising(callback)
    } catch (_: Exception) {
    }
  }

  private fun startScan(promise: Promise) {
    try {
      val bluetooth = adapter()
      val scanner = if (bluetooth != null && bluetooth.isEnabled) bluetooth.bluetoothLeScanner else null
      if (scanner == null) {
        promise.reject("E_BLE_UNAVAILABLE", "Bluetooth đang tắt hoặc máy không hỗ trợ quét BLE.", null)
        return
      }
      stopScan()

      // Lọc theo Service Data bắt đầu bằng 'GP' để hệ điều hành vẫn quét khi tắt màn hình.
      val filter = ScanFilter.Builder()
        .setServiceData(serviceUuid, magicPrefix)
        .build()
      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .build()

      val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
          val bytes = result.scanRecord?.getServiceData(serviceUuid) ?: return
          sendEvent("onPacket", mapOf("hex" to bytesToHex(bytes), "rssi" to result.rssi))
        }

        override fun onScanFailed(errorCode: Int) {
          sendEvent("onScanFailed", mapOf("code" to errorCode))
        }
      }

      scanCallback = callback
      scanner.startScan(listOf(filter), settings, callback)
      promise.resolve(true)
    } catch (e: SecurityException) {
      promise.reject("E_BLE_PERMISSION", "Chưa cấp quyền Bluetooth.", e)
    } catch (e: Exception) {
      promise.reject("E_BLE_SCAN", e.message ?: "Lỗi quét BLE.", e)
    }
  }

  private fun stopScan() {
    val callback = scanCallback ?: return
    scanCallback = null
    try {
      adapter()?.bluetoothLeScanner?.stopScan(callback)
    } catch (_: Exception) {
    }
  }

  private fun hexToBytes(hex: String): ByteArray {
    val clean = hex.filter { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }
    val out = ByteArray(clean.length / 2)
    for (i in out.indices) {
      out[i] = clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
    }
    return out
  }

  private fun bytesToHex(bytes: ByteArray): String {
    val builder = StringBuilder(bytes.size * 2)
    for (b in bytes) {
      builder.append(String.format("%02X", b.toInt() and 0xFF))
    }
    return builder.toString()
  }
}
