import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

export function useLenis() {
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;

    gsap.registerPlugin(ScrollTrigger);

    const syncScrollTrigger = () => ScrollTrigger.update();
    const updateLenis = (time: number) => {
      lenis?.raf(time * 1000);
    };

    const stop = () => {
      if (!lenis) return;
      gsap.ticker.remove(updateLenis);
      lenis.off("scroll", syncScrollTrigger);
      lenis.destroy();
      lenis = null;
      gsap.ticker.lagSmoothing(500, 33);
    };

    const start = () => {
      if (motionPreference.matches || lenis) return;

      lenis = new Lenis({
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
    };

    const onPreferenceChange = () => {
      if (motionPreference.matches) stop();
      else start();
    };

    start();
    motionPreference.addEventListener("change", onPreferenceChange);

    return () => {
      motionPreference.removeEventListener("change", onPreferenceChange);
      stop();
    };
  }, []);
}
