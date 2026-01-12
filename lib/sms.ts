// ✅ /lib/sms.ts

/**
 * 模擬發送簡訊驗證碼的函式。
 * 上線時可替換為真實的 SMS API（例如 Twilio、MessageBird、阿里雲 SMS 等）。
 */
export async function sendSMSCode(phone: string, code: string): Promise<boolean> {
  // 模擬簡訊發送行為
  console.log(`📲 [模擬簡訊] 發送驗證碼 ${code} 至電話號碼 ${phone}`);

  // 實際串接 SMS 平台範例（僅供參考）：
  // await fetch('https://api.twilio.com/send', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ to: phone, message: `你的驗證碼是 ${code}` })
  // });

  return true;
}
