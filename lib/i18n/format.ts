import { formatDateKa, memberSinceKa } from "@/lib/cabinet";
import { eventDateBadgeKa, eventDayMonthKa, formatEventTimeKa } from "@/lib/community";
import type { Locale } from "./routing";

export function formatMemberSince(value: string | null, locale: Locale): string | null {
  if (locale === "ka") return memberSinceKa(value);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tbilisi",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function eventDayMonth(value: string, locale: Locale) {
  const badge = eventDayMonthKa(value);
  if (locale === "ka" || !badge) return badge;
  return {
    day: badge.day,
    month: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tbilisi",
      month: "short",
    }).format(new Date(value)),
  };
}

export function formatDate(value: string, locale: Locale): string {
  if (locale === "ka") return formatDateKa(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tbilisi",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatEventTime(start: string, end: string | null, locale: Locale): string {
  if (locale === "ka") return formatEventTimeKa(start, end);
  const startDate = formatDate(start, locale);
  const startTime = formatTime(start);
  if (!end) return `${startDate}, ${startTime}`;
  const endDate = formatDate(end, locale);
  const endTime = formatTime(end);
  return startDate === endDate
    ? `${startDate}, ${startTime}–${endTime}`
    : `${startDate}, ${startTime} — ${endDate}, ${endTime}`;
}

export function eventDateBadge(value: string, locale: Locale) {
  const badge = eventDateBadgeKa(value);
  if (locale === "ka" || !badge.day) return badge;
  return {
    day: badge.day,
    monthYear: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tbilisi",
      month: "long",
      year: "numeric",
    }).format(new Date(value)),
  };
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tbilisi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
