"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const slides = [
  { src: "/shree-shyam-group-logo.png", alt: "Shree Shyam Group logo", fit: "object-contain bg-black" },
  { src: "/home/house-cropped.png", alt: "Shree Shyam Villa house", fit: "object-cover" },
  { src: "/home/plot-layout-refined.png", alt: "Sohel Dev plot layout", fit: "object-contain bg-white" },
];

export function HomeCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = (active + 1) % slides.length;
      setActive(next);
      track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <section className="relative overflow-hidden bg-black">
      <div ref={track} className="flex h-[70vh] min-h-[520px] snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide, index) => (
          <div key={slide.src} className="relative h-full min-w-full snap-center">
            <Image src={slide.src} alt={slide.alt} fill priority={index === 0} className={slide.fit} sizes="100vw" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/45 px-3 py-2">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show image ${index + 1}`}
            onClick={() => {
              setActive(index);
              track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: "smooth" });
            }}
            className={`h-2.5 w-2.5 rounded-full ${active === index ? "bg-brand" : "bg-white/70"}`}
          />
        ))}
      </div>
    </section>
  );
}
