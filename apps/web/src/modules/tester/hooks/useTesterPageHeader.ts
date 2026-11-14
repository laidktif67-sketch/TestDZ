import { useEffect, useState } from "react";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { getTesterHeaderProfile } from "../../../features/profile/profile-api";
import { countTesterUnreadNotifications } from "../../../features/notifications/notifications-api";

/** Shared read-only header data for tester pages; backend RLS remains authoritative. */
export function useTesterPageHeader() {
  const { session, roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    let alive = true;
    const userId = session.user.id;

    Promise.all([
      getTesterHeaderProfile(userId),
      countTesterUnreadNotifications(userId),
    ])
      .then(([profile, notification]) => {
        if (!alive) return;
        setName(
          profile.data?.display_name?.trim() ||
            session.user.email?.split("@")[0] ||
            "Tester",
        );
        setAvatar(profile.data?.avatar_url || "");
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

  const firstName = name.split(/\s+/)[0] || "Tester";
  return { roles, name, avatar, notifications, loading, firstName };
}
