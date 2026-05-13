import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { runOCR } from "../ocr/runOCR";
import "./ScanButton.css";

function ScanButton({ onLoading, onResult, onError, onReset }) {
  async function handleClick() {
    let photo;
    try {
      photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 90,
        allowEditing: false,
      });
    } catch (e) {
      if (/cancel|no image picked/i.test(e?.message ?? "")) return;
      console.error("Camera error:", e);
      onError();
      return;
    }

    onReset();
    onLoading();
    try {
      const extracted = await runOCR(photo.dataUrl);
      onResult(extracted);
    } catch (e) {
      console.error("OCR error:", e);
      onError();
    }
  }

  return (
    <button className="scan-btn" onClick={handleClick}>
      Scan
    </button>
  );
}

export default ScanButton;
