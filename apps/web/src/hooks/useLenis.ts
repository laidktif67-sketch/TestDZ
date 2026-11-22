import { useEffect } from "react";
import type Lenis from "lenis";

export function useLenis() {
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopPreference = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    let lenis: Lenis | null = null;
    let gsap: typeof import("gsap").gsap | null = null;
    let scrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger | null = null;
    let loading = false;
    let disposed = false;

    const syncScrollTrigger = () => scrollTrigger?.update();
    const updateLenis = (time: number) => lenis?.raf(time * 1000);

    const stop = () => {
      if (!lenis || !gsap) return;
      gsap.ticker.remove(updateLenis);
      lenis.off("scroll", syncScrollTrigger);
      lenis.destroy();
      lenis = null;
      gsap.ticker.lagSmoothing(500, 33);
    };

    const start = async () => {
      if (motionPreference.matches || !desktopPreference.matches || lenis || loading || disposed) return;
      loading = true;
      try {
        const [{ default: LenisConstructor }, gsapModule, scrollTriggerModule] = await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis/dist/lenis.css"),
        ]);
        if (disposed || motionPreference.matches || !desktopPreference.matches) return;

        gsap = gsapModule.gsap;
        scrollTrigger = scrollTriggerModule.ScrollTrigger;
        gsap.registerPlugin(scrollTrigger);
        lenis = new LenisConstructor({
          duration: 1.15,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          syncTouch: false,
          anchors: true,
          stopInertiaOnNavigate: true,
          respectReducedMotion: true,
        });
        lenis.on("scroll", syncScrollTrigger);
        gsap.ticker.add(updateLenis);
        gsap.ticker.lagSmoothing(0);
      } catch (error) {
        if (!disposed) console.error("Smooth scrolling could not be initialized", error);
      } finally {
        loading = false;
      }
    };

    const onPreferenceChange = () => {
      if (motionPreference.matches || !desktopPreference.matches) stop();
      else void start();
    };

    void start();
    motionPreference.addEventListener("change", onPreferenceChange);
    desktopPreference.addEventListener("change", onPreferenceChange);
    return () => {
      disposed = true;
      motionPreference.removeEventListener("change", onPreferenceChange);
      desktopPreference.removeEventListener("change", onPreferenceChange);
      stop();
    };
  }, []);
}
