// src/i18n/copy/authCopy.ts
// UI copy for the sign-in / registration screens (app/(auth)/*). Use: authCopy[language].
// Strings that already exist in translations.ts (welcomeBack, password, ...) stay there.
import type { Language } from "@/src/i18n/translations";

type AuthCopy = {
  emailLabel: string;
  emailExample: string;
  caregiverDesc: string;
  familyDesc: string;
  agencyDesc: string;
};

export const authCopy: Record<Language, AuthCopy> = {
  zh: {
    emailLabel: "Email",
    emailExample: "example@mail.com",
    caregiverDesc: "照顧長輩、回報健康與狀況",
    familyDesc: "查看長輩狀況、管理照護計畫",
    agencyDesc: "管理旗下看護與照護案件",
  },
  en: {
    emailLabel: "Email",
    emailExample: "example@mail.com",
    caregiverDesc: "Care for an elder and report health and status",
    familyDesc: "Follow your elder's status and manage the care plan",
    agencyDesc: "Manage your caregivers and care cases",
  },
  vi: {
    emailLabel: "Email",
    emailExample: "example@mail.com",
    caregiverDesc: "Chăm sóc người cao tuổi, báo cáo sức khỏe và tình trạng",
    familyDesc: "Theo dõi tình trạng người thân và quản lý kế hoạch chăm sóc",
    agencyDesc: "Quản lý người chăm sóc và các ca chăm sóc",
  },
  id: {
    emailLabel: "Email",
    emailExample: "example@mail.com",
    caregiverDesc: "Merawat lansia, melaporkan kesehatan dan kondisi",
    familyDesc: "Pantau kondisi lansia dan kelola rencana perawatan",
    agencyDesc: "Kelola caregiver dan kasus perawatan Anda",
  },
};
