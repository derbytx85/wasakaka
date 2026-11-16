import React, { createContext, useContext, useEffect, useState } from "react";
import { SettingsRepo } from "@/services/database/db";
import type { ThemeMode } from "@/types";

interface Ctx {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => Promise<void>;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => Promise<void>;
  weatherTipsEnabled: boolean;
  setWeatherTipsEnabled: (v: boolean) => Promise<void>;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [onboardingDone, setOnbState] = useState(false);
  const [weatherTipsEnabled, setWeatherState] = useState(true);

  useEffect(() => {
    (async () => {
      const t = (await SettingsRepo.get("theme")) as ThemeMode | null;
      if (t) setThemeState(t);
      const o = await SettingsRepo.get("onboarding_done");
      setOnbState(o === "true");
      const w = await SettingsRepo.get("weather_tips");
      setWeatherState(w !== "false");
    })();
  }, []);

  const setTheme = async (t: ThemeMode) => {
    setThemeState(t);
    await SettingsRepo.set("theme", t);
  };
  const setOnboardingDone = async (v: boolean) => {
    setOnbState(v);
    await SettingsRepo.set("onboarding_done", v ? "true" : "false");
  };
  const setWeatherTipsEnabled = async (v: boolean) => {
    setWeatherState(v);
    await SettingsRepo.set("weather_tips", v ? "true" : "false");
  };

  return (
    <SettingsContext.Provider
      value={{
        theme, setTheme,
        onboardingDone, setOnboardingDone,
        weatherTipsEnabled, setWeatherTipsEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}