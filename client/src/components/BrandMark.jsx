const BrandMark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="brandmark-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3b82f6" />
        <stop offset="1" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#brandmark-bg)" />
    <path
      d="M20 8.5c.9 5.6 3.4 8.6 9.5 9.6-6.1 1-8.6 4-9.5 9.6-.9-5.6-3.4-8.6-9.5-9.6 6.1-1 8.6-4 9.5-9.6Z"
      fill="#fff"
    />
    <circle cx="28.5" cy="28.5" r="2.5" fill="#bfdbfe" />
  </svg>
);

export default BrandMark;
