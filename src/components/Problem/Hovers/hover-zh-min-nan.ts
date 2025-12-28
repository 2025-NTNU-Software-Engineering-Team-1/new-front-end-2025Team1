export const hover_taiwanese = {
  // Description
  setDescription: "設定題目ê說明，包含標題、內容、範例測資等說明。",

  // Configuration
  setConfiguration: "配置題目ê基本設定，親像名、配額、語言限制等。",
  allowedLanguages: "選擇學生會使使ê程式語言。",
  maxZipSize: "設定學生上傳 ZIP 檔ê最大限制 (MB)。",
  tags: "幫題目設定標籤，方便分類佮搜揣 (用逗號分開)。",
  quota: "設定逐个學生ê提交次數限制，-1 代表無限制。",

  // AI Teaching Assistant
  aiTA: "開啟 AI 助教功能，學生會使透過 AI 接著作答提示。",
  aiModel: "選擇 AI 助教用ê模型版本。",
  selectAPIKeys: "選擇這个題目會使開ê API 金鑰 (會使選真濟个)。",
  activeAiKeys: "當當咧用ê API 金鑰，會輪流使。",
  inactiveAiKeys: "猶未開ê API 金鑰 (搝去頂面就開矣)。",

  // Trial Mode
  trialMode: "開啟測試模式，准學生佇正式提交進前先試行。",
  trialMaxNumber: "設定測試模式ê執行次數限制，-1 代表無限制。",
  resultVisible: "准學生看詳細ê測試結果佮錯誤訊息。",
  resultDownloadable: "准學生下載測試執行ê輸出檔案 (干焦佇結果看會著ê時陣有效)。",
  uploadPublicTestData: "上傳公開測資 ZIP 檔，予測試模式用 (包含 .in 佮 .out)。",
  uploadACFiles: "上傳正確答案 (AC/Reference) 程式碼。",

  // Network & Sidecars
  networkSidecars: "配置 Sidecar 容器，提供額外ê網路服務。",
  networkAccessRestriction: "設定外部網路存取限制。",
  networkAccessModel: "黑名單 (無定義ê就准) 抑是白名單 (無定義ê就擋)。",
  networkAccessIPList: "設定准抑是擋ê IP 地址列表。",
  networkAccessURLList: "設定准抑是擋ê URL 列表。",

  // Sandbox Environment
  SandboxEnvironment: "設定程式執行ê沙盒環境佮 Docker 映像檔。",
  Sidecars: "配置綴主程式做伙執行ê輔助容器 (Sidecars)。",
  dockerFiles: "上傳自訂 Dockerfile 嚟起執行環境。",

  // Sidecar Details
  sideCarName: "Sidecar 容器ê名。",
  sideCarImage: "Sidecar 用ê Docker 映像檔名稱。",
  sideCarArgs: "傳予 Sidecar 容器ê啟動參數。",
  sideCarEnv: "設定 Sidecar 容器ê環境變數。",

  // Artifacts
  ArtifactCollection: "設定需要對執行環境收集ê檔案 (Artifacts)。",
  CompiledBinary: "收集編譯後ê二進位檔。",
  StudentArtifact: "收集學生程式產生ê特定檔案。",

  // Pipeline
  setPipelines: "配置程式碼ê編譯佮執行流程。",
  fileAccess: "設定學生程式對檔案系統ê存取權限。",
  libraryRestrictionsGroup1: "設定靜態分析佮函式庫使用限制。",
  libraryRestrictionsGroup2: "設定進階函式庫佮語法限制。",
  importsRestrictions: "限制 Python 腳本會使匯入ê模組 (Imports)。",
  headersRestrictions: "限制 C/C++ 程式會使引用ê標頭檔 (Headers)。",
  functionsRestrictions: "限制程式會使叫ê特定函式。",
  syntaxRestrictions: "限制程式會使用ê語法結構 (親像 for, while 等)。",
  executionMode: "選擇程式執行模式 (一般模式、互動模式等)。",
  executionModeGeneral: "一般模式：標準輸入/輸出 (stdin/stdout) 判定。",
  executionModeFunctionOnly: "干焦函式模式：學生干焦需要實作指定ê函式 (親像 LeetCode)。",
  executionModeInteractive: "互動模式：學生程式需要佮測資程式進行互動溝通。",
  uploadFile: "上傳需要ê相關檔案 (親像 Makefile, Header 等)。",
  interactiveTeacherFirsts: "互動模式設定：敢愛先執行老師ê程式。",
  interactiveUploadTeacherCode: "上傳互動模式需要ê老師程式碼 (Interactor)。",
  customChecker: "開啟自訂檢測器 (Special Judge)。",
  uploadCustomChecker: "上傳自訂檢測腳本 (Python)。",
  uploadCustomScorer: "上傳自訂評分腳本。",
  customScoringScript: "開啟自訂評分邏輯。",
  aiCheckerEnable: "開啟 AI 輔助檢查 (AI Checker)。",

  // Test Data
  setTestData: "管理測試資料 (Test Data)。",
  setDataZipFile: "上傳包含所有測試資料ê ZIP 檔案。",

  // Resource Data
  setResourceData: "設定資源檔案。",
  setResourceDataStudent: "上傳學生會使存取ê資源檔案。",
  setResourceDataTeacher: "上傳干焦予評測端用ê資源檔案。",

  // Member
  student: "學生",
  TA: "助教",
};
