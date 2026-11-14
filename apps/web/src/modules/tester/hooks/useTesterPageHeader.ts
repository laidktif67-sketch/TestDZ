import { useEffect, useState } from "react";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { countTesterUnreadNotifications } from "../../../features/notifications/notifications-api";
import { useTesterProfile } from "./useTesterProfile";

/** Shared read-only header data for tester pages; backend RLS remains authoritative. */
export function useTesterPageHeader() {
  const { session, roles = [] } = useIdentity();
  const { name, avatar, firstName, loading: profileLoading } = useTesterProfile();
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setNotifications(0);
      setLoading(false);
      return;
    }

    let alive = true;
    setNotifications(0);
    setLoading(true);
    const userId = session.user.id;

    countTesterUnreadNotifications(userId)
      .then((notification) => {
        if (!alive) return;
        setNotifications(notification.count ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  return { roles, name, avatar, notifications, loading: loading || profileLoading, firstName };
}
