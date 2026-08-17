"use client"
import type { ComponentType } from "react";
import {
  DashboardOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  TrophyOutlined,
  SafetyCertificateOutlined,
  MessageOutlined,
  SettingOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  FlagOutlined,
  BankOutlined,
  GlobalOutlined,
  KeyOutlined,
} from "@ant-design/icons";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType;
};

/**
 * Nav config per role group. Executive roles (Super_Admin, National_Admin,
 * Observer_Admin) get the full dense set; task-focused roles (Zonal_Admin,
 * assessors, moderators) get a shorter, action-oriented set. Applicants
 * get their own minimal set entirely (see applicant nav below).
 */
export const EXECUTIVE_NAV: NavItem[] = [
  { key: "overview", label: "Overview", href: "/dashboard/overview", icon: DashboardOutlined },
  { key: "applicants", label: "Applicants", href: "/dashboard/applicants", icon: TeamOutlined },
  { key: "sectors", label: "Sectors & Trades", href: "/dashboard/sectors", icon: ApartmentOutlined },
  { key: "criteria", label: "Criteria", href: "/dashboard/criteria", icon: FileTextOutlined },
  { key: "assessment", label: "Assessment", href: "/dashboard/assessment", icon: CheckSquareOutlined },
  { key: "moderation", label: "Moderation", href: "/dashboard/moderation", icon: SafetyCertificateOutlined },
  { key: "results", label: "Results & Promotion", href: "/dashboard/results", icon: TrophyOutlined },
  { key: "awards", label: "Award Categories", href: "/dashboard/awards", icon: FlagOutlined },
  { key: "zones", label: "Zones & States", href: "/dashboard/zones", icon: GlobalOutlined },
  { key: "staff", label: "Staff & Roles", href: "/dashboard/staff", icon: BankOutlined },
  { key: "registration-codes", label: "Registration Codes", href: "/dashboard/registration-codes", icon: KeyOutlined },
  { key: "messages", label: "Messages", href: "/dashboard/messages", icon: MessageOutlined },
  { key: "audit", label: "Audit Log", href: "/dashboard/audit", icon: AuditOutlined },
  { key: "settings", label: "Cycle Settings", href: "/dashboard/settings", icon: SettingOutlined },
];

export const TASK_FOCUSED_NAV: NavItem[] = [
  { key: "overview", label: "My Tasks", href: "/dashboard/my-tasks", icon: DashboardOutlined },
  { key: "entries", label: "Entries", href: "/dashboard/entries", icon: CheckSquareOutlined },
  { key: "moderation", label: "Moderation", href: "/dashboard/moderation", icon: SafetyCertificateOutlined },
  { key: "messages", label: "Messages", href: "/dashboard/messages", icon: MessageOutlined },
];

// Zonal_Admin gets a slightly richer set than pure assessors/moderators,
// since they appoint staff and manage their zone's taxonomy view.
export const ZONAL_ADMIN_NAV: NavItem[] = [
  { key: "overview", label: "Zone Overview", href: "/dashboard/my-tasks", icon: DashboardOutlined },
  { key: "applicants", label: "Applicants", href: "/dashboard/applicants", icon: TeamOutlined },
  { key: "panels", label: "Panels & Assignments", href: "/dashboard/panels", icon: ClockCircleOutlined },
  { key: "entries", label: "Entries", href: "/dashboard/entries", icon: CheckSquareOutlined },
  { key: "moderation", label: "Moderation", href: "/dashboard/moderation", icon: SafetyCertificateOutlined },
  { key: "staff", label: "Staff", href: "/dashboard/staff", icon: BankOutlined },
  { key: "messages", label: "Messages", href: "/dashboard/messages", icon: MessageOutlined },
];

export const APPLICANT_NAV: NavItem[] = [
  { key: "overview", label: "My Status", href: "/dashboard/my-tasks", icon: DashboardOutlined },
  { key: "messages", label: "Messages", href: "/dashboard/messages", icon: MessageOutlined },
];
