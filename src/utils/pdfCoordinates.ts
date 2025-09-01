export const convertScreenToPDFCoordinates = (
  screenX: number,
  screenY: number,
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  scale: number = 1
) => {
  const scaleX = pageWidth / containerWidth;
  const scaleY = pageHeight / containerHeight;
  
  return {
    x: screenX * scaleX / scale,
    y: (containerHeight - screenY) * scaleY / scale
  };
};

export const convertPDFToScreenCoordinates = (
  pdfX: number,
  pdfY: number,
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  scale: number = 1
) => {
  const scaleX = containerWidth / pageWidth;
  const scaleY = containerHeight / pageHeight;
  
  return {
    x: pdfX * scaleX * scale,
    y: containerHeight - (pdfY * scaleY * scale)
  };
};