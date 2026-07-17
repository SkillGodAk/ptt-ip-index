# 多功能影片處理工具

這個 repository 提供 SkillGodAK 的 Windows 多功能影片處理工具公開 EXE，以及程式自動更新使用的 `version.json`。

## 最新版本

- 版本：`20260717`
- 檔案：`多功能影片處理工具.exe`
- Release：[v20260717](https://github.com/SkillGodAk/multi-function-video-tool/releases/tag/v20260717)
- 下載：[多功能影片處理工具.exe](https://github.com/SkillGodAk/multi-function-video-tool/releases/download/v20260717/multi-function-video-tool.exe)

## 20260717 更新內容

- 修正音軌字幕處理頁的日誌寫入錯誤，現在會即時顯示分析、處理進度與 FFmpeg 錯誤。
- 修正背景處理執行緒直接讀寫介面元件，可能導致音軌與字幕處理沒有執行的問題。
- 處理開始前會保存輸出位置與覆蓋設定，批次處理期間不再跨執行緒讀取介面狀態。
- 封裝完整 Tkinter Python 套件、Tcl/Tk DLL 與啟動路徑，避免 EXE 出現 `No module named 'tkinter'`。
- 使用雙音軌、中文字幕的真實測試影片驗證，並通過全部 36 項自動測試。
- EXE 檔名固定為 `多功能影片處理工具.exe`，版本只在程式視窗與更新資訊內顯示。

> 從 `20260717` 起重新作為正式版本起點，舊的測試版本已停用。

## 自動更新資料

程式會讀取：

```text
https://raw.githubusercontent.com/SkillGodAk/multi-function-video-tool/master/version.json
```

當 `version` 高於目前版本時，程式會提示是否下載並安裝更新。
