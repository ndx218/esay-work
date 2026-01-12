import toast from 'react-hot-toast';

const isZH = typeof navigator !== 'undefined' && navigator.language.toLowerCase().includes('zh');

type ActionType =
  | 'login'
  | 'email'
  | 'upload'
  | 'referral'
  | 'adminApproved'
  | 'adminRejected'
  | 'missingField'
  | 'unauthorized'
  | 'unknown';

// ✅ 成功提示
export function showSuccess(action: ActionType) {
  const messages: Record<ActionType, string> = {
    login: isZH ? '登入成功！🎉' : 'Successfully signed in! 🎉',
    email: isZH ? '登入連結已寄出 ✉️' : 'Login link sent ✉️',
    upload: isZH ? '上傳成功，請等待人工審核 📤' : 'Upload successful. Please wait for approval 📤',
    referral: isZH ? '推薦成功！🎁 點數將自動發放' : 'Referral success! Points will be credited 🎁',
    adminApproved: isZH ? '已通過審核並發放點數 ✅' : 'Approved and points granted ✅',
    adminRejected: isZH ? '已拒絕申請 ❌' : 'Submission rejected ❌',
    missingField: isZH ? '請填寫所有必填欄位 ⚠️' : 'Please fill in all required fields ⚠️',
    unauthorized: isZH ? '無權限查看此頁面 🔒' : 'Unauthorized access 🔒',
    unknown: isZH ? '操作成功' : 'Operation successful',
  };

  toast.success(messages[action] || messages.unknown, { duration: 3000 });
}

// ✅ 錯誤提示
export function showError(action: ActionType) {
  const messages: Record<ActionType, string> = {
    login: isZH ? '登入失敗，請稍後再試 😢' : 'Sign-in failed, please try again 😢',
    email: isZH ? '信件發送失敗，請確認 Email 格式或稍後再試 ✉️' : 'Email send failed. Please try again later ✉️',
    upload: isZH ? '上傳失敗，請稍後再試 ❌' : 'Upload failed. Please try again ❌',
    referral: isZH ? '推薦碼無效或重複使用 ⚠️' : 'Invalid or reused referral code ⚠️',
    adminApproved: isZH ? '審核處理錯誤 ❌' : 'Approval failed ❌',
    adminRejected: isZH ? '拒絕操作失敗 ❌' : 'Rejection failed ❌',
    missingField: isZH ? '缺少欄位 ⚠️' : 'Missing fields ⚠️',
    unauthorized: isZH ? '你沒有存取權限 🔐' : 'Access denied 🔐',
    unknown: isZH ? '操作失敗，請稍後再試' : 'Something went wrong, please try again',
  };

  toast.error(messages[action] || messages.unknown, { duration: 4000 });
}
