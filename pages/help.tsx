// pages/help.tsx
'use client';

import dynamic from 'next/dynamic';

const TopNavigation = dynamic(() => import('@/components/TopNavigation'), {
  ssr: false,
});

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)', backgroundAttachment: 'fixed' }}>
      <TopNavigation />
      <div className="pt-20 max-w-3xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-white">❓ 使用教學與常見問題</h1>

        <div className="space-y-8">
          <section className="bg-slate-700/50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2 text-white">📌 如何使用 Assignment Terminator？</h2>
            <ol className="list-decimal list-inside text-slate-300 space-y-1">
              <li>在主頁的左邊欄位輸入你的功課資料，例如題目、學校、字數要求等。</li>
              <li>輸入完畢後，點擊「✨ 生成草稿」按鈕，系統將自動為你建立一份初稿。</li>
              <li>初稿生成後，你可以查看 AI 草稿，並按下一步進入老師模擬修訂版本。</li>
              <li>如需進一步優化，點擊「Undetectable 優化」或「GPT 降 AI」按鈕。</li>
              <li>當你對結果滿意後，便可以複製作業內容並交功課囉 🎉</li>
            </ol>
          </section>

          <section className="bg-slate-700/50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2 text-white">🛠️ 功能說明</h2>
            <ul className="list-disc list-inside text-slate-300 space-y-1">
              <li><strong>✨ 生成草稿：</strong> 根據你的輸入自動產生初稿。</li>
              <li><strong>✏️ 第二輪修訂：</strong> 模擬老師的修訂意見並重新整理內容。</li>
              <li><strong>🧪 Undetectable 優化：</strong> 使文本更自然、人性化，降低 AI 痕跡。</li>
              <li><strong>🤖 GPT 降 AI：</strong> 讓 AI 語感降得更自然，避免被檢測出是機器生成。</li>
            </ul>
          </section>

          <section className="bg-slate-700/50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2 text-white">💡 常見問題</h2>
            <ul className="text-slate-300 space-y-6">
              <li>
                <strong>Q: 這個平台是免費的嗎？</strong><br />
                A: 是的！目前平台處於公開測試階段，所有功能完全免費，
                希望你多多試用，也歡迎提供意見幫助我們改進 🧠
              </li>
              <li>
                <strong>Q: 我的輸入資料會被儲存嗎？</strong><br />
                A: 不會的！你的輸入資料（例如題目、姓名等）不會被儲存在伺服器上，
                我們重視你的隱私與安全，請放心使用 🙏
              </li>
              <li>
                <strong>Q: 可以用在不同科目的功課上嗎？</strong><br />
                A: 當然可以！不論是中文、英文、通識、科學，只要你輸入明確，
                系統都能幫你生成合適的內容，還能自訂語氣與風格！
              </li>
              <li>
                <strong>Q: 系統生成的內容會不會被 Turnitin 或 AI 偵測工具發現？</strong><br />
                A: 我們提供「Undetectable 優化」與「GPT 降 AI」功能，
                能夠幫你降低機器語感。不過我們還是建議你再加入個人語句，
                這樣不僅更自然，也更安全喔 😉
              </li>
              <li>
                <strong>Q: 如果我遇到問題怎麼辦？</strong><br />
                A: 你可以聯絡我們！<br />
                📱 WeChat: <code>AA551218aa</code><br />
                ✉️ Email: <code>ndx218@gmail.com</code><br />
                📞 WhatsApp：<code>61886911</code><br />
                我們會盡快回覆你 📨
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
