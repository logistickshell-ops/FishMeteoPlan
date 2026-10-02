import { useEffect, useState } from "react";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser };
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  HapticFeedback?: { selectionChanged?: () => void };
};

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

export function useTelegram() {
  const [telegram, setTelegram] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    webApp.ready?.();
    webApp.expand?.();
    webApp.setHeaderColor?.("#0f172a");
    if (webApp.initDataUnsafe?.user) setUser(webApp.initDataUnsafe.user);
    setTelegram(webApp);
  }, []);

  return {
    isTelegram: Boolean(telegram),
    user,
    initData: telegram?.initData ?? "",
    hapticSelection: () => telegram?.HapticFeedback?.selectionChanged?.(),
  };
}
