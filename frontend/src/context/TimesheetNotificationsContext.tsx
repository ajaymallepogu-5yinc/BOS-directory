import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { fetchTimesheetEntries } from "../api/timesheetApi";
import { useAuth } from "./AuthContext";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface TimesheetNotificationsContextType {
  /** Count of pending approval batches (employee + week) - manager-only. */
  pendingApprovals: number;
  /** Count of the current employee's own rejected weeks still needing a fix. */
  rejectedWeeks: number;
  /**
   * Forces both counts to re-fetch right now, regardless of the current route. Call this after
   * any action that changes a Timesheet's status (review, save, submit) - the route-based
   * auto-fetch below deliberately skips the page that owns that data (to avoid a duplicate
   * fetch on load), so without this explicit call the Sidebar badge would show a stale count
   * until the user navigates elsewhere and back.
   */
  refresh: () => void;
}

const TimesheetNotificationsContext = createContext<TimesheetNotificationsContextType | undefined>(undefined);

export function TimesheetNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [rejectedWeeks, setRejectedWeeks] = useState(0);

  const fetchPending = useCallback(() => {
    if (!user?.isManager) {
      setPendingApprovals(0);
      return;
    }
    fetchTimesheetEntries("team")
      .then((entries) => {
        const pendingGroups = new Set(
          entries
            .filter((e) => e.timesheetStatus === "Pending")
            .map((e) => `${e.employeeId}_${toIsoDate(getMonday(new Date(e.workDate.slice(0, 10) + "T00:00:00")))}`)
        );
        setPendingApprovals(pendingGroups.size);
      })
      .catch(() => setPendingApprovals(0));
  }, [user?.isManager]);

  const fetchRejected = useCallback(() => {
    if (!user) {
      setRejectedWeeks(0);
      return;
    }
    fetchTimesheetEntries("mine")
      .then((entries) => {
        const rejected = new Set(
          entries
            .filter((e) => e.timesheetStatus === "Rejected")
            .map((e) => toIsoDate(getMonday(new Date(e.workDate.slice(0, 10) + "T00:00:00"))))
        );
        setRejectedWeeks(rejected.size);
      })
      .catch(() => setRejectedWeeks(0));
  }, [user]);

  // Auto-refresh on route change - skipped while sitting on the page that already fetches the
  // exact same scope itself, so this isn't a redundant duplicate of that page's own load.
  useEffect(() => {
    if (location.pathname !== "/team-approvals") fetchPending();
  }, [fetchPending, location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/timesheet") fetchRejected();
  }, [fetchRejected, location.pathname]);

  // Unlike the route-based effects above, this always fetches regardless of the current
  // page - it's meant to be called right after a mutation so the badge is correct immediately,
  // not just once the user navigates away and the route-based skip stops applying.
  const refresh = useCallback(() => {
    fetchPending();
    fetchRejected();
  }, [fetchPending, fetchRejected]);

  return (
    <TimesheetNotificationsContext.Provider value={{ pendingApprovals, rejectedWeeks, refresh }}>
      {children}
    </TimesheetNotificationsContext.Provider>
  );
}

export function useTimesheetNotifications() {
  const context = useContext(TimesheetNotificationsContext);
  if (context === undefined) {
    throw new Error("useTimesheetNotifications must be used within a TimesheetNotificationsProvider");
  }
  return context;
}
