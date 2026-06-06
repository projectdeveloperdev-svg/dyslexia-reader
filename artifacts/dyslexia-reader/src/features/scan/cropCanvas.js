/**
 * Crops a region from a full-resolution image using an offscreen canvas.
 *
 * @param {string} imageUrl
 *   Full-resolution data URL (from normaliseCapture — up to 4000px).
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 *   Pixel coordinates in the ORIGINAL image, as returned by react-easy-crop's
 *   onCropComplete `croppedAreaPixels` argument.
 * @returns {Promise<string>} Cropped image as a JPEG data URL.
 */
export async function getCroppedImg(imageUrl, pixelCrop) {
  const image = await loadImage(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  canvas
    .getContext("2d")
    .drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

  return canvas.toDataURL("image/jpeg", 0.98);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("[cropCanvas] Failed to load image"));
    img.src = url;
  });
}
