import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { runOCR } from "../ocr/runOCR";

function UploadButton({ onLoading, onResult, onError, onReset }) {
  async function handleClick() {
    let photo;
    try {
      photo = await Camera.getPhoto({
        source: CameraSource.Photos,
        resultType: CameraResultType.DataUrl,
        quality: 90,
        allowEditing: false,
      });
    } catch (e) {
      if (/cancel|no image picked/i.test(e?.message ?? "")) return;
      console.error("Photos error:", e);
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
      Upload
    </button>
  );
}

export default UploadButton;
