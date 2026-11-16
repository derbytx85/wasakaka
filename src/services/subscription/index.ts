import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesError,
} from "react-native-purchases";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { SettingsRepo } from "@/services/database/db";
import type { PlanType } from "@/types";

const KEY = "subscription_plan";

export async function initRevenueCat(): Promise<void> {
  try {
    const apiKey =
      Platform.OS === "android"
        ? Constants.expoConfig?.extra?.revenueCatApiKeyAndroid
        : Constants.expoConfig?.extra?.revenueCatApiKeyIOS;

    if (!apiKey) {
      console.warn("[RevenueCat] API key no configurada");
      return;
    }

    await Purchases.configure({ apiKey });

    Purchases.addCustomerInfoUpdateListener((info) => {
      updateLocalPlan(info);
    });

    const info = await Purchases.getCustomerInfo();
    await updateLocalPlan(info);
  } catch (error) {
    console.error("[RevenueCat] Error al inicializar:", error);
  }
}

async function updateLocalPlan(info: CustomerInfo): Promise<void> {
  const isPro = Boolean(info?.entitlements?.active?.["pro"]);
  const currentPlan = isPro ? "pro" : "free";
  await SettingsRepo.set(KEY, currentPlan);
}

export const SubscriptionService = {
  async getCurrentPlan(): Promise<PlanType> {
    const v = await SettingsRepo.get(KEY);
    return (v as PlanType) || "free";
  },
  async isPro(): Promise<boolean> {
    return (await this.getCurrentPlan()) === "pro";
  },
  async setPlan(plan: PlanType): Promise<void> {
    await SettingsRepo.set(KEY, plan);
  },
  async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      return await Purchases.getOfferings();
    } catch (error) {
      console.error("[RevenueCat] Error al obtener ofertas:", error);
      return null;
    }
  },
  async purchase(packageToPurchase: PurchasesPackage): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: PurchasesError;
  }> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      await updateLocalPlan(customerInfo);
      return { success: true, customerInfo };
    } catch (error) {
      return { success: false, error: error as PurchasesError };
    }
  },
  async restorePurchases(): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: PurchasesError;
  }> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      await updateLocalPlan(customerInfo);
      return { success: true, customerInfo };
    } catch (error) {
      return { success: false, error: error as PurchasesError };
    }
  },
  async canCreatePlace(currentCount: number): Promise<boolean> {
    const isPro = await this.isPro();
    if (isPro) return true;
    return currentCount < 2;
  },
  async canCreateItem(currentCount: number): Promise<boolean> {
    const isPro = await this.isPro();
    if (isPro) return true;
    return currentCount < 5;
  },
};