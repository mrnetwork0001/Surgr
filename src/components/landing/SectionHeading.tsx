import BlurText from "./BlurText";

interface Props {
  label: string;
  title: string;
  lead?: string;
  maxWidth?: string;
}

export default function SectionHeading({ label, title, lead, maxWidth = "max-w-[14ch]" }: Props) {
  return (
    <div className="mb-14">
      <div className="mb-6 font-body text-sm text-white/80">{`// ${label}`}</div>
      <BlurText
        as="h2"
        align="start"
        text={title}
        className={`${maxWidth} font-heading text-5xl italic leading-[0.9] tracking-[-2.5px] text-white md:text-6xl lg:text-[5rem] lg:tracking-[-3px]`}
      />
      {lead && <p className="mt-6 max-w-2xl font-body text-base font-light leading-snug text-white/80 md:text-lg">{lead}</p>}
    </div>
  );
}
