import { useSession, signOut } from "next-auth/react";
import { useCredits } from "@/hooks/usePointStore";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const { data: session } = useSession();
  const credits = useCredits();
  return (
    <div className="w-full bg-green-50 border-b border-green-200 px-4 py-2 text-sm flex justify-between items-center">
      <div>
        👤 <span className="font-medium">{session?.user?.email}</span>
         ｜ 目前剩餘 <span className="font-bold text-blue-600">{credits}</span> 點
      </div>
      <Button
        variant="ghost"
        className="text-red-600 hover:text-black px-2 py-1"
        onClick={() => {
          localStorage.removeItem("skipLogin");
          signOut({ callbackUrl: "/login" });
        }}
      >
        🚪 登出
      </Button>
    </div>
  );
}
