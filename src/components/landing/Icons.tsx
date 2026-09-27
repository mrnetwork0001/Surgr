import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const stroke = (props: IconProps, width = 2) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

const filled = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  ...props,
});

export function ArrowUpRight(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M7 17L17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

export function Play(props: IconProps) {
  return (
    <svg {...filled(props)}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...stroke(props, 1.5)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...stroke(props, 1.5)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9" />
      <path d="M12 3a15 15 0 0 0-4 9 15 15 0 0 0 4 9" />
    </svg>
  );
}

/** Material "verified_user": closed-loop verification. */
export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...filled(props)}>
      <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  );
}

/** Material "assignment_turned_in": the WHO checklist. */
export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...filled(props)}>
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  );
}

/** Material "graphic_eq": the spoken alert. */
export function WaveIcon(props: IconProps) {
  return (
    <svg {...filled(props)}>
      <path d="M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z" />
    </svg>
  );
}
