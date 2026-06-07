import { useState } from "react";

/**
 * Renders the StudySphere logo. Prefers a user-supplied PNG at
 * /logo.png (drop it in frontend/public/), and automatically falls back to the
 * bundled vector emblem at /logo.svg if the PNG isn't present.
 */
export default function Logo({
  className = "",
  alt = "StudySphere",
}: {
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState("/logo.png");
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      draggable={false}
      onError={() => {
        if (src !== "/logo.svg") setSrc("/logo.svg");
      }}
    />
  );
}
