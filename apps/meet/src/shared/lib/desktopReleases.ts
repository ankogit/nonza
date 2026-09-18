export const DESKTOP_GITHUB_REPO = "ankogit/nonza";

export const DESKTOP_RELEASES_LATEST_URL =
  `https://github.com/${DESKTOP_GITHUB_REPO}/releases/latest`;

const DOWNLOAD_ASSETS = {
  windows: "Nonza-windows.msi",
  macos: "Nonza-macos.dmg",
} as const;

export function getDesktopDownloadUrl(
  platform: keyof typeof DOWNLOAD_ASSETS,
): string {
  return `${DESKTOP_RELEASES_LATEST_URL}/download/${DOWNLOAD_ASSETS[platform]}`;
}
