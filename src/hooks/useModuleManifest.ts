import { useEffect } from "react";

/**
 * Troca dinamicamente o manifest da página para permitir a instalação
 * de um app dedicado a um módulo específico (PWA por módulo).
 */
export function useModuleManifest(options: {
  manifest: string;
  appleTitle?: string;
  appleTouchIcon?: string;
}) {
  const { manifest, appleTitle, appleTouchIcon } = options;

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const titleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');

    const prevManifest = link?.getAttribute("href") || null;
    const prevTitle = titleMeta?.getAttribute("content") || null;
    const prevIcon = iconLink?.getAttribute("href") || null;

    if (link) link.setAttribute("href", manifest);
    if (titleMeta && appleTitle) titleMeta.setAttribute("content", appleTitle);
    if (iconLink && appleTouchIcon) iconLink.setAttribute("href", appleTouchIcon);

    return () => {
      if (link && prevManifest) link.setAttribute("href", prevManifest);
      if (titleMeta && prevTitle) titleMeta.setAttribute("content", prevTitle);
      if (iconLink && prevIcon) iconLink.setAttribute("href", prevIcon);
    };
  }, [manifest, appleTitle, appleTouchIcon]);
}
