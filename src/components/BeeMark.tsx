export function BeeMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="BeeFit strong bee lifting a barbell" xmlns="http://www.w3.org/2000/svg">
      <title>BeeFit strong bee</title>
      <path d="M22 18C6 7 5 26 22 27M42 18C58 7 59 26 42 27" fill="#f7fafc" stroke="#192025" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M23 12 17 6M41 12 47 6" stroke="#192025" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="32" cy="39" rx="16" ry="19" fill="#facc15" stroke="#192025" strokeWidth="3"/>
      <path d="M18 32h28M17 44h30" stroke="#192025" strokeWidth="6"/>
      <circle cx="32" cy="21" r="12" fill="#facc15" stroke="#192025" strokeWidth="3"/>
      <circle cx="28" cy="19" r="2" fill="#192025"/><circle cx="36" cy="19" r="2" fill="#192025"/>
      <path d="M28 25q4 4 8 0" fill="none" stroke="#192025" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 35 10 26M45 35 54 26" stroke="#facc15" strokeWidth="8" strokeLinecap="round"/>
      <path d="M19 35 10 26M45 35 54 26" stroke="#192025" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 21v10M3 21v10M58 21v10M61 21v10M3 26h12M49 26h12" stroke="#192025" strokeWidth="3" strokeLinecap="round"/>
      <path d="M25 56 22 61M39 56 42 61" stroke="#192025" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}
