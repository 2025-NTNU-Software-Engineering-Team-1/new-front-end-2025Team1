export const hover_zh = {
  // Description
  setDescription: "設定題目的描述，包含標題、內容、範例測資等說明。",

  // Configuration
  setConfiguration: "配置題目的基本設定，如名稱、配額、語言限制等。",
  allowedLanguages: "選擇學生可以使用的程式語言。",
  maxZipSize: "設定學生上傳 ZIP 檔案的最大限制 (MB)。",
  tags: "為題目設定標籤，方便分類與搜尋 (以逗號分隔)。",
  quota: "設定每位學生的提交次數限制，-1 代表無限制。",

  // AI Teaching Assistant
  aiTA: "啟用 AI 助教功能，學生可透過 AI 獲得解題提示。",
  aiModel: "選擇 AI 助教使用的模型版本。",
  selectAPIKeys: "選擇此題目可使用的 API 金鑰 (可多選)。",
  activeAiKeys: "目前啟用中的 API 金鑰，將輪詢使用。",
  inactiveAiKeys: "尚未啟用的 API 金鑰 (拖曳至上方啟用)。",

  // Trial Mode
  trialMode: "啟用試用模式，允許學生在正式繳交前進行測試執行。",
  trialMaxNumber: "設定試用模式的執行次數限制，-1 代表無限制。",
  resultVisible: "允許學生查看試用執行的詳細結果與錯誤訊息。",
  resultDownloadable: "允許學生下載試用執行的輸出檔案 (僅在結果可見時有效)。",
  uploadPublicTestData: "上傳公開測資 ZIP 檔，供試用模式使用 (包含 .in 與 .out)。",
  uploadACFiles: "上傳正確解答 (AC/Reference) 程式碼。",

  // Network & Sidecars
  networkSidecars: "配置 Sidecar 容器，提供額外的網路服務。",
  networkAccessRestriction: "設定外部網路存取限制。",
  networkAccessModel: "黑名單 (這模式下，沒有被定義的為允許) 或 白名單 (這模式下，沒有被定義的為禁止)。",
  networkAccessIPList: "設定允許或阻擋的 IP 位址列表。",
  networkAccessURLList: "設定允許或阻擋的 URL 列表。",

  // Sandbox Environment
  SandboxEnvironment: "設定程式執行的沙箱環境與 Docker 映像檔。",
  Sidecars: "配置伴隨主程式執行的輔助容器 (Sidecars)。",
  dockerFiles: "上傳自訂 Dockerfile 以建置執行環境。",

  // Sidecar Details
  sideCarName: "Sidecar 容器名稱。",
  sideCarImage: "Sidecar 使用的 Docker 映像檔名稱。",
  sideCarArgs: "傳遞給 Sidecar 容器的啟動參數。",
  sideCarEnv: "設定 Sidecar 容器的環境變數。",

  // Artifacts
  ArtifactCollection: "設定需要從執行環境中收集的檔案 (Artifacts)。",
  CompiledBinary: "收集編譯後的二進位執行檔。",
  StudentArtifact: "收集學生程式產生的特定檔案。",

  // Pipeline
  setPipelines: "配置程式碼的編譯與執行流程。",
  fileAccess: "設定學生程式對檔案系統的存取權限。",
  libraryRestrictionsGroup1: "設定靜態分析與函式庫使用限制。",
  libraryRestrictionsGroup2: "設定進階函式庫與語法限制。",
  importsRestrictions: "限制 Python 腳本可匯入的模組 (Imports)。",
  headersRestrictions: "限制 C/C++ 程式可引用的標頭檔 (Headers)。",
  functionsRestrictions: "限制程式可呼叫的特定函式。",
  syntaxRestrictions: "限制程式可使用的語法結構 (如 for, while 等)。",
  executionMode: "選擇程式執行模式 (一般模式、互動模式等)。",
  executionModeGeneral: "一般模式：標準輸入/輸出 (stdin/stdout) 判定。",
  executionModeFuncitonOnly: "僅函式模式：學生只需實作指定函式 (類似 LeetCode)。",
  executionModeInteractive: "互動模式：學生程式需與測資程式進行互動溝通。",
  uploadFile: "上傳所需的相關檔案 (如 Makefile, Header 等)。",
  interactiveTeacherFirsts: "互動模式設定：是否先執行老師的程式。",
  interactiveUploadTeacherCode: "上傳互動模式所需的老師程式碼 (Interactor)。",
  customChecker: "啟用自訂檢測器 (Special Judge)。",
  uploadCustomChecker: "上傳自訂檢測腳本 (Python)。",
  uploadCustomScorer: "上傳自訂評分腳本。",
  customScoringScript: "啟用自訂評分邏輯。",
  aiCheckerEnable: "啟用 AI 輔助檢查 (AI Checker)。",

  // Test Data
  setTestData: "管理測試資料 (Test Data)。",
  setDataZipFile: "上傳包含所有測試資料的 ZIP 檔案。",

  // Resource Data
  setResourceData: "設定資源檔案。",
  setResourceDataStudent: "上傳學生可存取的資源檔案。",
  setResourceDataTeacher: "上傳僅供評測端使用的資源檔案。",

  // Member
  student: "學生",
  TA: "助教",
};
