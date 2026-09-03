interface QuickWindow {
  isFocused(): boolean;
  hide(): void;
}

interface QuickWindows {
  platform: NodeJS.Platform;
  main: QuickWindow | null;
  overlay: QuickWindow | null;
  activateExternal: () => Promise<void>;
}

export async function prepareQuickWindows({ platform, main, overlay, activateExternal }: QuickWindows): Promise<void> {
  const ownsFocus = Boolean(main?.isFocused() || overlay?.isFocused());
  overlay?.hide();
  if (platform === "darwin") {
    // Hiding a window in native fullscreen / Split View can leave a black Space.
    // An external foreground window can be captured by ID with our main window intact.
    if (ownsFocus) await activateExternal();
  } else {
    // Preserve the existing foreground handoff on Windows and Linux.
    main?.hide();
  }
}
