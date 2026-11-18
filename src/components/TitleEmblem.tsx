export function TitleEmblem() {
  return (
    <div className="flex flex-col [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-center items-start gap-2 [@media(max-height:500px)]:gap-2.5">
      <svg
        width="64"
        height="44"
        viewBox="0 0 64 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-14 h-10 [@media(max-height:500px)]:w-10 [@media(max-height:500px)]:h-7 lg:w-16 lg:h-11 shrink-0"
      >
        {/* Misregistered cobalt Ghost crosshair */}
        <circle cx="38" cy="22" r="14" stroke="#2f5485" strokeWidth="2.2" strokeDasharray="4 3" />
        <line x1="38" y1="3" x2="38" y2="41" stroke="#2f5485" strokeWidth="1.4" strokeOpacity="0.8" />
        <line x1="19" y1="22" x2="57" y2="22" stroke="#2f5485" strokeWidth="1.4" strokeOpacity="0.8" />
        {/* Charcoal Ink registration mark */}
        <circle cx="24" cy="22" r="14" stroke="#1e2024" strokeWidth="2.4" />
        <line x1="24" y1="3" x2="24" y2="41" stroke="#1e2024" strokeWidth="1.5" />
        <line x1="5" y1="22" x2="43" y2="22" stroke="#1e2024" strokeWidth="1.5" />
        {/* Vermilion Dot courier pip at center */}
        <circle cx="31" cy="22" r="4.5" fill="#c93b2b" stroke="#1e2024" strokeWidth="1.5" />
      </svg>
      <h1 className="font-display text-5xl [@media(max-height:500px)]:text-3xl lg:text-6xl font-bold tracking-tight text-[#1e2024] leading-none">
        MISPRINT
      </h1>
    </div>
  );
}
