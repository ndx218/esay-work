// /pages/recharge.tsx
import dynamic from 'next/dynamic';

// ❗️關鍵：用 dynamic 且禁止 SSR
const RechargeContent = dynamic(() => import('@/components/RechargeContent'), {
  ssr: false,
});

export default function RechargePage() {
  return <RechargeContent />;
}
