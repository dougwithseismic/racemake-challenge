export function SectionDivider() {
  return (
    <div className="absolute bottom-0 left-0 w-full z-[3]">
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block w-full h-[60px] md:h-[120px]"
      >
        <polygon points="0,0 0,120 1440,120 1440,80 920,80 680,0" fill="#0F0F0F" />
      </svg>
    </div>
  );
}
