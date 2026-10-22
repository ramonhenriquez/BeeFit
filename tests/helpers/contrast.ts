/** WCAG 2 relative luminance and contrast for opaque CSS hex/rgb colors. */
export function contrast(first: string, second: string): number {
  const luminance = (color: string) => {
    const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    const rgb = color.trim().match(/^rgb\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*\)$/);
    let channels: number[];
    if (hex) {
      const value = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
      channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
    } else if (rgb) channels = rgb.slice(1).map(Number);
    else throw new Error(`Unsupported or non-opaque contrast color: ${color}`);
    const linear = channels.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
