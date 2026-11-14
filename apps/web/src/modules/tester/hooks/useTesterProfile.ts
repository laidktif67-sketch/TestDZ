import { useEffect, useState } from "react";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { getTesterHeaderProfile } from "../../../features/profile/profile-api";

/** Shared read-only tester profile state for tester-facing pages. */
export function useTesterProfile() {
  const { session } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = session?.user;
    if (!user?.id) {
      setName("Tester");
      setAvatar("");
      setLoading(false);
      return;
    }

    let alive = true;
    setName(user.email?.split("@")[0] || "Tester");
    setAvatar("");
    setLoading(true);
    Promise.resolve(getTesterHeaderProfile(user.id))
      .then(({ data }) => {
        if (!alive) return;
        setName(data?.display_name?.trim() || user.email?.split("@")[0] || "Tester");
        setAvatar(data?.avatar_url || "");
      })
      .catch(() => {
        if (!alive) return;
        setName(user.email?.split("@")[0] || "Tester");
        setAvatar("");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [session?.user?.id, session?.user?.email]);

  const firstName = name.split(/\s+/)[0] || "Tester";
  return { name, avatar, firstName, loading };
}
