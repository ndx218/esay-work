'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ReferralCodeFormProps {
  userId: string;
  referredBy?: string | null; // 判斷是否已填推薦碼
}

export default function ReferralCodeForm({ userId, referredBy }: ReferralCodeFormProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applied, setApplied] = useState(!!referredBy); // 預設為是否已填

  const handleApply = async () => {
    if (!code.trim()) {
      toast.error('請輸入推薦碼');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/apply-referral-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, referralCode: code }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('推薦碼已成功綁定！');
        setApplied(true);
      } else {
        toast.error(data.error || '綁定失敗');
      }
    } catch (err) {
      toast.error('系統錯誤，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (applied) {
    return <p className="text-sm text-muted-foreground">您已填寫推薦碼，無法再次修改。</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="輸入推薦碼"
        disabled={isSubmitting}
        className="w-[180px]"
      />
      <Button onClick={handleApply} isLoading={isSubmitting}>
        使用推薦碼
      </Button>
    </div>
  );
}
