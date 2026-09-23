/*
 * BantAI semantic icon layer.
 *
 * All icons come from @phosphor-icons/react at regular weight for consistency
 * (per taste-skill: standardize strokeWidth globally). Components consume the
 * semantic names below, not raw Phosphor imports. Swapping the underlying
 * library later means changing this file only.
 *
 * Weights used:
 *   - regular (default): general UI, labels, buttons
 *   - fill: solid semantic badges (threat, critical) where the shape needs
 *     to command attention. Never used for identity or informational icons.
 */

import React from 'react';
import {
  Question,
  CheckCircle,
  WarningDiamond,
  Warning,
  WarningOctagon,
  Info,
  MagnifyingGlass,
  X,
  CaretDown,
  CaretUp,
  CaretUpDown,
  Bell,
  FunnelSimple,
  Tray,
  ChartLine,
  ChatCircle,
  Target,
  SquaresFour,
  FileText,
  UsersThree,
  Brain,
  Gear,
  MagnifyingGlassPlus,
  List,
} from '@phosphor-icons/react';

type IconProps = {
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
};

/* ---------- Semantic status icons ---------- */

export const UnknownIcon = (props: IconProps) => (
  <Question size={16} weight="regular" {...props} />
);
export const VerifiedIcon = (props: IconProps) => (
  <CheckCircle size={16} weight="regular" {...props} />
);
export const SuspiciousIcon = (props: IconProps) => (
  <WarningDiamond size={16} weight="regular" {...props} />
);
export const ThreatIcon = (props: IconProps) => (
  <Warning size={16} weight="fill" {...props} />
);
export const CriticalIcon = (props: IconProps) => (
  <WarningOctagon size={16} weight="fill" {...props} />
);

/* ---------- Informational (petrol) ---------- */

export const InfoIcon = (props: IconProps) => (
  <Info size={16} weight="regular" {...props} />
);

/* ---------- Form + control icons ---------- */

export const SearchIcon = (props: IconProps) => (
  <MagnifyingGlass size={16} weight="regular" {...props} />
);
export const ClearIcon = (props: IconProps) => (
  <X size={14} weight="bold" {...props} />
);
export const CaretDownIcon = (props: IconProps) => (
  <CaretDown size={14} weight="regular" {...props} />
);
export const SortIcon = (props: IconProps) => (
  <CaretUpDown size={12} weight="regular" {...props} />
);
export const SortAscIcon = (props: IconProps) => (
  <CaretUp size={12} weight="bold" {...props} />
);
export const SortDescIcon = (props: IconProps) => (
  <CaretDown size={12} weight="bold" {...props} />
);

/* ---------- State icons ---------- */

export const EmptyIcon = (props: IconProps) => (
  <Tray size={28} weight="regular" {...props} />
);
export const NoResultsIcon = (props: IconProps) => (
  <MagnifyingGlassPlus size={28} weight="regular" {...props} />
);
export const ErrorIcon = (props: IconProps) => (
  <WarningOctagon size={28} weight="regular" {...props} />
);

/* ---------- Utility bar icons ---------- */

export const NotificationsIcon = (props: IconProps) => (
  <Bell size={18} weight="regular" {...props} />
);
export const HelpIcon = (props: IconProps) => (
  <Question size={18} weight="regular" {...props} />
);
export const FilterIcon = (props: IconProps) => (
  <FunnelSimple size={18} weight="regular" {...props} />
);
export const MenuIcon = (props: IconProps) => (
  <List size={18} weight="regular" {...props} />
);
export const CloseIcon = (props: IconProps) => (
  <X size={18} weight="regular" {...props} />
);

/* ---------- Sidebar nav icons (samples for ShellPreviewPage) ---------- */

export const NavOverviewIcon = (props: IconProps) => (
  <SquaresFour size={18} weight="regular" {...props} />
);
export const NavCampaignsIcon = (props: IconProps) => (
  <Target size={18} weight="regular" {...props} />
);
export const NavMessagesIcon = (props: IconProps) => (
  <ChatCircle size={18} weight="regular" {...props} />
);
export const NavAnalyticsIcon = (props: IconProps) => (
  <ChartLine size={18} weight="regular" {...props} />
);
export const NavReportsIcon = (props: IconProps) => (
  <FileText size={18} weight="regular" {...props} />
);
export const NavSearchIcon = (props: IconProps) => (
  <MagnifyingGlass size={18} weight="regular" {...props} />
);
export const NavUsersIcon = (props: IconProps) => (
  <UsersThree size={18} weight="regular" {...props} />
);
export const NavModelIcon = (props: IconProps) => (
  <Brain size={18} weight="regular" {...props} />
);
export const NavSystemIcon = (props: IconProps) => (
  <Gear size={18} weight="regular" {...props} />
);
