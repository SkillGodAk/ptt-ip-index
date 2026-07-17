# 多功能影片處理工具

這個 repository 提供 SkillGodAK 的 Windows 多功能影片處理工具公開 EXE，以及程式自動更新使用的 `version.json`。

## 最新版本

- 版本：`20260717-3`
- 檔案：`多功能影片處理工具20260717-3.exe`
- Release：[v20260717-3](https://github.com/SkillGodAk/multi-function-video-tool/releases/tag/v20260717-3)
- 下載：[20260717-3.exe](https://github.com/SkillGodAk/multi-function-video-tool/releases/download/v20260717-3/20260717-3.exe)

## 20260717-3 更新內容

- 修正自動更新完成後重新啟動時，找不到 `python312.dll` 的錯誤。
- 自我更新重啟時會建立新的 PyInstaller 暫存環境，不再沿用已被清除的舊 `_MEI` 目錄。
- 更新下載視窗會顯示已下載容量與即時進度。
- 保留手動檢查更新、`Season 02` 等季數自動判斷、略過原因統計與重命名報告功能。

## 自動更新資料

程式會讀取：

```text
https://raw.githubusercontent.com/SkillGodAk/multi-function-video-tool/master/version.json
```

當 `version` 高於目前版本時，程式會提示是否下載並安裝更新。
